/**
 * __tests__/chat.test.js
 * Tests: 200-message cap on session.messages
 */
"use strict";

jest.mock("../models/ChatSession.model");
jest.mock("../services/gemini.service", () => ({
  sendChatMessage:      jest.fn().mockResolvedValue({ aiText: "ok", updatedHistory: [], tokenCount: 10 }),
  generateSessionTitle: jest.fn().mockResolvedValue("Test"),
}));
jest.mock("../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const ChatSession = require("../models/ChatSession.model");
const chatSvc     = require("../services/chat.service");

describe("chat.service - sendMessage message cap", () => {
  const makeSession = (msgCount) => {
    const messages = Array.from({ length: msgCount }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: `msg${i}` }));
    return {
      _id:         "sess1",
      user:        "user1",
      messages,
      history:     [],
      hasEmergency: false,
      title:       "Existing Title",
      markModified: jest.fn(),
      save:         jest.fn().mockResolvedValue(true),
    };
  };

  it("caps messages at 200 when session already has 200 messages", async () => {
    const session = makeSession(200);
    ChatSession.findOne = jest.fn().mockResolvedValue(session);
    await chatSvc.sendMessage("sess1", "user1", "hello");
    // After push of 2 new messages (201 total would be 202), should be sliced to 200
    expect(session.messages.length).toBeLessThanOrEqual(200);
  });

  it("does NOT trim when under 200 messages", async () => {
    const session = makeSession(10);
    ChatSession.findOne = jest.fn().mockResolvedValue(session);
    await chatSvc.sendMessage("sess1", "user1", "hello");
    // 10 + 2 = 12, still under 200
    expect(session.messages.length).toBe(12);
  });

  it("throws 404 for unknown session", async () => {
    ChatSession.findOne = jest.fn().mockResolvedValue(null);
    await expect(chatSvc.sendMessage("bad_id", "user1", "hello"))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
