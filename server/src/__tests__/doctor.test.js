/**
 * __tests__/doctor.test.js
 * Tests: getMyPatients pagination
 *
 * The service now uses a single Appointment.aggregate() pipeline with a $facet stage.
 * Mocks must reflect the aggregation output shape:
 *   [ { data: [...patientDocs], meta: [{ total: N }] } ]
 */
"use strict";

jest.mock("../models/User.model");
jest.mock("../models/Appointment.model");
jest.mock("../models/HealthRecord.model");
jest.mock("../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const mongoose    = require("mongoose");
const Appointment = require("../models/Appointment.model");
const doctorSvc   = require("../services/doctor.service");

/* Use a fixed valid ObjectId so new mongoose.Types.ObjectId(String(doctorId)) succeeds */
const DOCTOR_ID = new mongoose.Types.ObjectId().toHexString(); // 24-char hex string

describe("doctor.service - getMyPatients", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns paginated envelope", async () => {
    const patients = [{ _id: new mongoose.Types.ObjectId(), name: "Alice" },
                      { _id: new mongoose.Types.ObjectId(), name: "Bob" }];

    /* Aggregation result shape: array with one $facet document */
    Appointment.aggregate = jest.fn().mockResolvedValue([{
      data: patients,
      meta: [{ total: 2 }],
    }]);

    const r = await doctorSvc.getMyPatients(DOCTOR_ID, { page: 1, limit: 10 });
    expect(r).toMatchObject({ total: 2, page: 1, limit: 10, totalPages: 1 });
    expect(Array.isArray(r.patients)).toBe(true);
    expect(r.patients).toHaveLength(2);
  });

  it("caps limit at 50", async () => {
    Appointment.aggregate = jest.fn().mockResolvedValue([{
      data: [],
      meta: [],
    }]);

    const r = await doctorSvc.getMyPatients(DOCTOR_ID, { limit: 999 });
    expect(r.limit).toBe(50);
  });

  it("defaults to page=1 limit=20", async () => {
    Appointment.aggregate = jest.fn().mockResolvedValue([{
      data: [],
      meta: [],
    }]);

    const r = await doctorSvc.getMyPatients(DOCTOR_ID);
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });
});

const User = require("../models/User.model");

describe("doctor.service — P2-1 verified-doctors-only restriction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("searchDoctors always filters on doctorProfile.isVerified: true", async () => {
    User.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      skip:   jest.fn().mockReturnThis(),
      limit:  jest.fn().mockReturnThis(),
      lean:   jest.fn().mockResolvedValue([]),
    });
    User.countDocuments = jest.fn().mockResolvedValue(0);

    await doctorSvc.searchDoctors({ specialization: 'cardiology' });

    const [query] = User.find.mock.calls[0];
    expect(query).toMatchObject({ role: 'doctor', isActive: true, 'doctorProfile.isVerified': true });
  });

  it("searchDoctors cannot be tricked into showing unverified doctors via a query param", async () => {
    User.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      skip:   jest.fn().mockReturnThis(),
      limit:  jest.fn().mockReturnThis(),
      lean:   jest.fn().mockResolvedValue([]),
    });
    User.countDocuments = jest.fn().mockResolvedValue(0);

    /* Even if a client sends verified=false, the base query must still hard-require true */
    await doctorSvc.searchDoctors({ verified: 'false' });

    const [query] = User.find.mock.calls[0];
    expect(query['doctorProfile.isVerified']).toBe(true);
  });

  it("getDoctorById 404s when the doctor is not verified (query excludes it)", async () => {
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean:   jest.fn().mockResolvedValue(null), // unverified doctor never matches the query
    });

    await expect(doctorSvc.getDoctorById('doctor_unverified_1')).rejects.toMatchObject({ statusCode: 404 });

    const [query] = User.findOne.mock.calls[0];
    expect(query).toMatchObject({ role: 'doctor', isActive: true, 'doctorProfile.isVerified': true });
  });

  it("getDoctorById returns the doctor when verified", async () => {
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean:   jest.fn().mockResolvedValue({ _id: 'doctor_1', name: 'Dr. Verified' }),
    });

    const doctor = await doctorSvc.getDoctorById('doctor_1');
    expect(doctor.name).toBe('Dr. Verified');
  });
});
