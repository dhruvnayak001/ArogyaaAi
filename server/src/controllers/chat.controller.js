/**
 * controllers/chat.controller.js
 * HTTP layer for AI chat sessions and messaging
 */

'use strict';

const chatService = require('../services/chat.service');
const geminiSvc   = require('../services/gemini.service');
const catchAsync  = require('../utils/catchAsync');
const AppError    = require('../utils/AppError');
const logger      = require('../config/logger');
const { detectEmergencyKeywords } = require('../utils/emergencyKeywords');

/* GET /chat/sessions */
const getSessions = catchAsync(async (req, res) => {
  const sessions = await chatService.getSessions(req.user._id);
  res.status(200).json({ success: true, data: { sessions } });
});

/* GET /chat/sessions/:sessionId */
const getSession = catchAsync(async (req, res) => {
  const session = await chatService.getSessionById(
    req.params.sessionId,
    req.user._id
  );
  res.status(200).json({
    success: true,
    data: { session, messages: session.messages },
  });
});

/* POST /chat/sessions */
const createSession = catchAsync(async (req, res) => {
  const session = await chatService.createSession(
    req.user._id,
    req.body.title
  );
  res.status(201).json({ success: true, data: { session } });
});

/* DELETE /chat/sessions/:sessionId */
const deleteSession = catchAsync(async (req, res) => {
  await chatService.deleteSession(req.params.sessionId, req.user._id);
  res.status(200).json({ success: true, message: 'Session deleted' });
});

/* POST /chat/sessions/:sessionId/messages */
const sendMessage = catchAsync(async (req, res) => {
  const { content, attachments } = req.body;

  if (!content || typeof content !== 'string' || content.trim() === '') {
    throw new AppError('Message content is required.', 400);
  }

  logger.info(`[ChatController] User ${req.user._id} sending message to session ${req.params.sessionId}`);

  const { userMessage, aiMessage } = await chatService.sendMessage(
    req.params.sessionId,
    req.user._id,
    content,
    attachments || []
  );
  res.status(201).json({ success: true, data: { userMessage, aiMessage } });
});

/* GET /chat/sessions/:sessionId/messages */
const getMessages = catchAsync(async (req, res) => {
  const session = await chatService.getSessionById(
    req.params.sessionId,
    req.user._id
  );
  res.status(200).json({
    success: true,
    data: { messages: session.messages },
  });
});

/* GET /chat/sessions/:sessionId/summary */
const getSessionSummary = catchAsync(async (req, res) => {
  const summary = await chatService.getSessionSummary(
    req.params.sessionId,
    req.user._id
  );
  res.status(200).json({ success: true, data: { summary } });
});

/* POST /chat/emergency-analysis */
const analyzeEmergency = catchAsync(async (req, res) => {
  const { symptoms, vitals, conditions } = req.body;
  /* req.user is a lean object — Mongoose virtuals are not available.
     Compute age from dateOfBirth (added to protect's .select() for this reason). */
  const dob = req.user?.dateOfBirth;
  const ageYears = dob
    ? Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : undefined;

  /* Multilingual keyword pre-check (EN / HI / MR) */
  const kwMatch = detectEmergencyKeywords(symptoms);
  if (kwMatch.detected) {
    logger.warn(
      `[EMERGENCY] Keyword match: "${kwMatch.matchedKeyword}" ` +
      `— user=${req.user?._id}`
    );
  }

  const analysis = await geminiSvc.analyzeEmergency(symptoms, {
    vitals, conditions,
    age: ageYears,
    localKeywordDetected: kwMatch.detected ? kwMatch.matchedKeyword : null,
  });
  res.status(200).json({ success: true, data: { analysis } });
});

module.exports = {
  getSessions,
  getSession,
  createSession,
  deleteSession,
  sendMessage,
  getMessages,
  getSessionSummary,
  analyzeEmergency,
};
