/**
 * __tests__/logger.test.js
 * Tests: logger exports a valid winston logger, rotating transport in production
 */
"use strict";

describe("config/logger", () => {
  it("exports a logger with standard methods", () => {
    const logger = require("../config/logger");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("uses DailyRotateFile transport in production", () => {
    const fs  = require("fs");
    const src = fs.readFileSync(require.resolve("../config/logger"), "utf8");
    expect(src).toContain("DailyRotateFile");
    expect(src).toContain("winston-daily-rotate-file");
    expect(src).toContain("maxFiles");
    expect(src).toContain("14d");
  });
});

describe("utils/sendEmail - verifySmtp", () => {
  it("exports verifySmtp function", () => {
    jest.mock("nodemailer", () => ({
      createTransport: () => ({
        verify:   jest.fn().mockResolvedValue(true),
        sendMail: jest.fn(),
      }),
    }));
    const { verifySmtp } = require("../utils/sendEmail");
    expect(typeof verifySmtp).toBe("function");
  });
});
