/**
 * __tests__/record.test.js
 * Tests: getRecords pagination, getAiSummary record limit + confirmed filter
 */
"use strict";

jest.mock("../models/HealthRecord.model");
jest.mock("../models/User.model");
jest.mock("../services/gemini.service", () => ({ generateMedicalSummary: jest.fn().mockResolvedValue("summary") }));
jest.mock("../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const HealthRecord = require("../models/HealthRecord.model");
const User         = require("../models/User.model");
const recordSvc    = require("../services/record.service");

const chainMock = (data) => ({
  sort:   jest.fn().mockReturnThis(),
  skip:   jest.fn().mockReturnThis(),
  limit:  jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lean:   jest.fn().mockResolvedValue(data),
});

describe("record.service - getRecords", () => {
  it("returns paginated envelope", async () => {
    HealthRecord.find             = jest.fn().mockReturnValue(chainMock([{ _id: "r1" }]));
    HealthRecord.countDocuments   = jest.fn().mockResolvedValue(1);
    const r = await recordSvc.getRecords("user1", { page: 1, limit: 10 });
    expect(r).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
    expect(Array.isArray(r.records)).toBe(true);
  });

  it("defaults to page=1 limit=20", async () => {
    HealthRecord.find           = jest.fn().mockReturnValue(chainMock([]));
    HealthRecord.countDocuments = jest.fn().mockResolvedValue(0);
    const r = await recordSvc.getRecords("user1");
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });

  it("caps limit at 50", async () => {
    HealthRecord.find           = jest.fn().mockReturnValue(chainMock([]));
    HealthRecord.countDocuments = jest.fn().mockResolvedValue(0);
    const r = await recordSvc.getRecords("user1", { limit: 999 });
    expect(r.limit).toBe(50);
  });
});

describe("record.service - getAiSummary", () => {
  it("fetches only confirmed records with limit 30", async () => {
    User.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ name: "Test", age: 30, bloodGroup: "A+", chronicConditions: [], allergies: [] }) });
    HealthRecord.find = jest.fn().mockReturnValue(chainMock([{ title: "CBC", type: "lab_report", description: "normal" }]));

    await recordSvc.getAiSummary("user1");

    const findArgs = HealthRecord.find.mock.calls[0][0];
    expect(findArgs.confirmationStatus).toBe("confirmed");

    const chain = HealthRecord.find.mock.results[0].value;
    expect(chain.limit.mock.calls[0][0]).toBe(30);
  });

  it("throws 400 when no records found", async () => {
    User.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ name: "Test" }) });
    HealthRecord.find = jest.fn().mockReturnValue(chainMock([]));
    await expect(recordSvc.getAiSummary("user1")).rejects.toMatchObject({ statusCode: 400 });
  });
});
