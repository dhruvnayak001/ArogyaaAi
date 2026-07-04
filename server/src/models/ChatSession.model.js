/**
 * models/ChatSession.model.js
 * AI chat session and message schema
 */

'use strict';

const mongoose = require('mongoose');

/* ── Message sub-schema ── */
const MessageSchema = new mongoose.Schema(
  {
    role: {
      type:     String,
      enum:     ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type:     String,
      required: true,
      maxlength: 10000,
    },
    /* Optional: for multimodal messages */
    attachments: [
      {
        type: { type: String, enum: ['image', 'document'] },
        url:  String,
        name: String,
      },
    ],
    /* Metadata */
    isEmergency:  { type: Boolean, default: false },
    emergencySeverity: {
      type: String,
      enum: ['low', 'moderate', 'high', 'critical', null],
      default: null,
    },
    tokens: { type: Number, default: 0 }, // Gemini token count
  },
  { timestamps: true }
);

/* ── Chat Session schema ── */
const ChatSessionSchema = new mongoose.Schema(
  {
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    title: {
      type:    String,
      default: 'New Conversation',
      maxlength: 100,
    },
    /* Gemini conversation history (for multi-turn context) */
    history: [
      {
        role:  { type: String, enum: ['user', 'model'] },
        parts: [{ text: String }],
      },
    ],
    messages: [MessageSchema],
    /* Emergency flag for the session */
    hasEmergency: { type: Boolean, default: false },
    /* AI-generated session summary */
    aiSummary: {
      content:     { type: String, default: null },
      generatedAt: { type: Date,   default: null },
    },
    /* Status */
    isArchived: { type: Boolean, default: false },
    messageCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ── Indexes ── */
ChatSessionSchema.index({ user: 1, createdAt: -1 });
ChatSessionSchema.index({ user: 1, isArchived: 1 });

/* ── Pre-save: update message count ── */
ChatSessionSchema.pre('save', function (next) {
  this.messageCount = this.messages.length;
  next();
});

const ChatSession = mongoose.model('ChatSession', ChatSessionSchema);

module.exports = ChatSession;
