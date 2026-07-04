/**
 * services/chat.service.js
 * Business logic for AI chat sessions and message handling
 */

'use strict';

const ChatSession  = require('../models/ChatSession.model');
const AppError     = require('../utils/AppError');
const geminiSvc    = require('./gemini.service');
const logger       = require('../config/logger');

/* ════════════════════════════════════════
   SESSIONS
   ════════════════════════════════════════ */

/**
 * Get all sessions for a user (no messages — lightweight list)
 */
const getSessions = async (userId) => {
  const sessions = await ChatSession.find({ user: userId, isArchived: false })
    .select('title messageCount hasEmergency createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .lean();
  return sessions;
};

/**
 * Get a single session with its messages
 */
const getSessionById = async (sessionId, userId) => {
  const session = await ChatSession.findOne({ _id: sessionId, user: userId });
  if (!session) throw new AppError('Chat session not found.', 404);
  return session;
};

/**
 * Create a new empty session
 */
const createSession = async (userId, title = 'New Conversation') => {
  const session = await ChatSession.create({ user: userId, title });
  logger.info(`Chat session created: ${session._id} for user ${userId}`);
  return session;
};

/**
 * Soft-delete (archive) a session
 */
const deleteSession = async (sessionId, userId) => {
  const session = await ChatSession.findOneAndUpdate(
    { _id: sessionId, user: userId },
    { isArchived: true },
    { new: true }
  );
  if (!session) throw new AppError('Chat session not found.', 404);
  return session;
};

/* ════════════════════════════════════════
   MESSAGES
   ════════════════════════════════════════ */

/**
 * sendMessage
 * Sends a user message to Gemini and persists both turns to the session.
 * Auto-generates session title on first message.
 *
 * @param {string} sessionId
 * @param {string} userId
 * @param {string} content   - User message text
 * @param {Array}  attachments
 * @returns {{ userMessage, aiMessage, session }}
 */
const sendMessage = async (sessionId, userId, content, attachments = []) => {
  /* 1. Load session (validates ownership) */
  const session = await ChatSession.findOne({ _id: sessionId, user: userId });
  if (!session) throw new AppError('Chat session not found.', 404);

  /* 2. Call Gemini with full conversation history */
  // Sanitize history strictly: Gemini SDK fails if roles don't strictly alternate or texts are empty
  const rawHistory = session.history.map((h) => ({
    role: h.role,
    parts: h.parts.filter((p) => p.text?.trim()).map((p) => ({ text: p.text })),
  })).filter(h => h.parts.length > 0);
  
  const safeHistory = [];
  let expectedRole = 'user';
  for (const h of rawHistory) {
    if (h.role === expectedRole) {
      safeHistory.push(h);
      expectedRole = expectedRole === 'user' ? 'model' : 'user';
    }
  }
  
  if (safeHistory.length % 2 !== 0) {
    safeHistory.pop();
  }

  // Trim to last 20 turns (10 exchanges) to prevent Gemini context overflow on long sessions
  const MAX_HISTORY_TURNS = 20;
  const trimmedHistory = safeHistory.length > MAX_HISTORY_TURNS
    ? safeHistory.slice(safeHistory.length - MAX_HISTORY_TURNS)
    : safeHistory;

  logger.info(`[ChatService] Session ${sessionId}: history turns=${trimmedHistory.length}, sending message len=${content.length}`);

  const { aiText, updatedHistory, tokenCount } =
    await geminiSvc.sendChatMessage(trimmedHistory, content);

  /* 3. Build message documents */
  const userMessage = {
    role:        'user',
    content,
    attachments,
    createdAt:   new Date(),
  };

  /* Emergency keyword quick-scan (detailed analysis via /emergency endpoint) */
  const EMERGENCY_KEYWORDS = /\b(chest pain|can't breathe|unconscious|stroke|seizure|overdose|suicid|heart attack|bleeding heavily|not breathing)\b/i;
  const isEmergency = EMERGENCY_KEYWORDS.test(content);

  const aiMessage = {
    role:      'assistant',
    content:   aiText,
    tokens:    tokenCount,
    isEmergency,
    createdAt: new Date(),
  };

  /* 4. Persist to session */
  session.messages.push(userMessage, aiMessage);

  /* Cap embedded messages array to prevent BSON document size overflow.
     MongoDB has a 16 MB document limit. With long AI responses, an uncapped
     array can hit this limit and fail to save after months of active use.
     We keep the last 200 messages — that's 100 full exchanges of context.
     The AI history (trimmedHistory above) is separately capped at 20 turns. */
  if (session.messages.length > 200) {
    session.messages = session.messages.slice(session.messages.length - 200);
  }

  session.history      = updatedHistory;
  session.hasEmergency = session.hasEmergency || isEmergency;
  session.markModified('history');

  /* 5. Auto-title on first user message — non-blocking: don't let it crash the save */
  if (session.messages.length <= 2 && session.title === 'New Conversation') {
    try {
      session.title = await geminiSvc.generateSessionTitle(content);
    } catch (titleErr) {
      logger.warn(`[ChatService] Title generation failed (non-fatal): ${titleErr.message}`);
      session.title = content.slice(0, 40) + (content.length > 40 ? '...' : '');
    }
  }

  await session.save();

  /* Return the persisted message docs (they now have _id) */
  const savedMessages = session.messages;
  const savedUser = savedMessages[savedMessages.length - 2];
  const savedAI   = savedMessages[savedMessages.length - 1];

  return { userMessage: savedUser, aiMessage: savedAI, session };
};

/**
 * Get AI summary of a session
 */
const getSessionSummary = async (sessionId, userId) => {
  const session = await ChatSession.findOne({ _id: sessionId, user: userId })
    .populate('user', 'name age bloodGroup chronicConditions allergies');
  if (!session) throw new AppError('Chat session not found.', 404);

  /* Return cached summary if recent (< 1 hour old) */
  const ONE_HOUR = 60 * 60 * 1000;
  if (
    session.aiSummary?.content &&
    session.aiSummary.generatedAt &&
    Date.now() - new Date(session.aiSummary.generatedAt).getTime() < ONE_HOUR
  ) {
    return session.aiSummary.content;
  }

  /* Build transcript for summarization */
  const transcript = session.messages
    .filter((m) => m.role !== 'system')
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n');

  const patientInfo = {
    name:              session.user?.name || 'Patient',
    age:               session.user?.age,
    bloodGroup:        session.user?.bloodGroup,
    chronicConditions: session.user?.chronicConditions,
    allergies:         session.user?.allergies,
  };

  const summary = await geminiSvc.generateMedicalSummary(transcript, patientInfo);

  /* Cache the summary */
  session.aiSummary = { content: summary, generatedAt: new Date() };
  await session.save();

  return summary;
};

module.exports = {
  getSessions,
  getSessionById,
  createSession,
  deleteSession,
  sendMessage,
  getSessionSummary,
};
