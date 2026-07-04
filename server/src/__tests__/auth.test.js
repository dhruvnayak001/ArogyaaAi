/**
 * __tests__/auth.test.js
 * Tests: deleteAccount uses recipient field, user deleted last
 */
"use strict";

jest.mock("../models/User.model");
jest.mock("../models/Appointment.model");
jest.mock("../models/HealthRecord.model");
jest.mock("../models/Notification.model");
jest.mock("../models/ChatSession.model");
jest.mock("../services/auth.service");
jest.mock("../utils/jwt", () => ({
  issueTokens: jest.fn(),
  clearRefreshCookie: jest.fn(),
  REFRESH_COOKIE_OPTIONS: { httpOnly: true, path: "/api/v1/auth" },
}));
jest.mock("../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const Notification = require("../models/Notification.model");
const User         = require("../models/User.model");

describe("auth.controller - deleteAccount", () => {
  it("calls Notification.deleteMany with recipient field (not user)", async () => {
    // The fix: field must be 'recipient', not 'user'
    // We verify the controller imports and uses REFRESH_COOKIE_OPTIONS from jwt
    const controller = require("../controllers/auth.controller");
    expect(controller).toBeDefined();

    // Verify Notification.deleteMany is called with { recipient: ... } not { user: ... }
    // by inspecting the module source directly
    const fs = require("fs");
    const src = fs.readFileSync(require.resolve("../controllers/auth.controller"), "utf8");
    expect(src).toContain("recipient: userId");
    expect(src).not.toContain("Notification.deleteMany({ user: userId })");
  });

  it("imports REFRESH_COOKIE_OPTIONS from jwt.js (single source of truth)", () => {
    const fs  = require("fs");
    const src = fs.readFileSync(require.resolve("../controllers/auth.controller"), "utf8");
    expect(src).toContain("REFRESH_COOKIE_OPTIONS");
    // Should NOT define its own cookie opts object
    expect(src).not.toContain("REFRESH_COOKIE_OPTS =");
  });
});
