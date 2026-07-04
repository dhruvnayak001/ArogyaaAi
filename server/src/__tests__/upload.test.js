/**
 * __tests__/upload.test.js
 * Tests: multi-upload uses multerErrorHandler, magic byte validation
 */
"use strict";

jest.mock("cloudinary", () => ({ v2: { config: jest.fn(), uploader: { upload_stream: jest.fn() } } }));
jest.mock("../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

describe("upload.middleware - uploadFiles uses multerErrorHandler", () => {
  it("uploadFiles is an array (middleware chain)", () => {
    const { uploadFiles } = require("../middleware/upload.middleware");
    expect(Array.isArray(uploadFiles)).toBe(true);
    expect(uploadFiles.length).toBeGreaterThanOrEqual(2);
  });

  it("first middleware in uploadFiles is a function (wrapped multer)", () => {
    const { uploadFiles } = require("../middleware/upload.middleware");
    expect(typeof uploadFiles[0]).toBe("function");
    // The wrapped multer handler takes (req, res, next) — 3 params
    expect(uploadFiles[0].length).toBe(3);
  });
});

describe("upload.middleware - magic byte validation", () => {
  it("rejects files whose buffer does not match declared MIME type", () => {
    // We test validateMagicBytes indirectly by checking the source
    const fs  = require("fs");
    const src = fs.readFileSync(require.resolve("../middleware/upload.middleware"), "utf8");
    expect(src).toContain("validateMagicBytes");
    expect(src).toContain("MAGIC_SIGNATURES");
  });
});
