/**
 * __tests__/appointment.test.js
 * Tests: double-booking prevention, pagination, slot conflict
 */
"use strict";

jest.mock("../models/Appointment.model");
jest.mock("../models/User.model");
jest.mock("../models/HealthRecord.model");
jest.mock("../services/notification.service", () => ({ createNotification: jest.fn().mockResolvedValue({}) }));
jest.mock("../utils/sendEmail", () => ({ sendEmail: jest.fn().mockResolvedValue({}), templates: { appointmentBooked: () => ({ subject: "", html: "" }) } }));
jest.mock("../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const Appointment = require("../models/Appointment.model");
const User        = require("../models/User.model");
const apptSvc     = require("../services/appointment.service");

const mockPatientId = "patient123";
const mockDoctorId  = "doctor456";

const mockDoctor = {
  _id:           mockDoctorId,
  name:          "Dr. Test",
  email:         "dr@test.com",
  doctorProfile: { consultationFee: 500, consultationModes: [{ mode: "clinic", fee: 500, duration: 30, enabled: true }] },
};

describe("appointment.service - bookAppointment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findOne = jest.fn().mockResolvedValue(mockDoctor);
    Appointment.findOne = jest.fn().mockResolvedValue(null);
  });

  it("throws 409 on DB duplicate key error (11000)", async () => {
    const dup  = new Error("dup key");
    dup.code   = 11000;
    Appointment.create = jest.fn().mockRejectedValue(dup);
    await expect(apptSvc.bookAppointment(mockPatientId, { doctorId: mockDoctorId, date: "2024-12-01", time: "10:00", reason: "Checkup" }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws 409 when findOne finds an existing active slot", async () => {
    Appointment.findOne = jest.fn().mockResolvedValue({ _id: "existing" });
    await expect(apptSvc.bookAppointment(mockPatientId, { doctorId: mockDoctorId, date: "2024-12-01", time: "10:00", reason: "Checkup" }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws 400 on self-booking", async () => {
    await expect(apptSvc.bookAppointment(mockDoctorId, { doctorId: mockDoctorId, date: "2024-12-01", time: "10:00", reason: "Checkup" }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 (Doctor not found) when the doctor is not verified (P2-1)", async () => {
    /* Unverified doctors must never receive bookings — the lookup query
       includes 'doctorProfile.isVerified': true, so User.findOne returns
       null for an unverified doctor exactly like a nonexistent one. */
    User.findOne = jest.fn().mockResolvedValue(null);

    await expect(apptSvc.bookAppointment(mockPatientId, { doctorId: mockDoctorId, date: "2024-12-01", time: "10:00", reason: "Checkup" }))
      .rejects.toMatchObject({ statusCode: 404, message: /doctor not found/i });

    const [query] = User.findOne.mock.calls[0];
    expect(query).toMatchObject({ _id: mockDoctorId, role: 'doctor', isActive: true, 'doctorProfile.isVerified': true });
  });
});

describe("appointment.service - getAppointments pagination", () => {
  const chainMock = (data) => ({
    populate: jest.fn().mockReturnThis(),
    sort:     jest.fn().mockReturnThis(),
    skip:     jest.fn().mockReturnThis(),
    limit:    jest.fn().mockReturnThis(),
    lean:     jest.fn().mockResolvedValue(data),
  });

  it("returns paginated envelope", async () => {
    Appointment.find = jest.fn().mockReturnValue(chainMock([{ _id: "a1" }]));
    Appointment.countDocuments = jest.fn().mockResolvedValue(1);
    const r = await apptSvc.getAppointments("u1", "patient", { page: 1, limit: 10 });
    expect(r).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
    expect(Array.isArray(r.appointments)).toBe(true);
  });

  it("caps limit at 50", async () => {
    Appointment.find = jest.fn().mockReturnValue(chainMock([]));
    Appointment.countDocuments = jest.fn().mockResolvedValue(0);
    await apptSvc.getAppointments("u1", "patient", { limit: 999 });
    const chain = Appointment.find.mock.results[0].value;
    expect(chain.limit.mock.calls[0][0]).toBeLessThanOrEqual(50);
  });
});
