/**
 * middleware/upload.middleware.js
 * Centralised multer + Cloudinary upload pipeline
 *
 * Usage in routes:
 *   const { uploadFile } = require('../middleware/upload.middleware');
 *   router.post('/', uploadFile, controller.create);
 *
 * What it does:
 *  1. multer validates file type + size, holds buffer in memory
 *  2. cloudinaryUpload() streams the buffer to Cloudinary
 *  3. Attaches { secure_url, public_id, original_filename, bytes, format }
 *     back onto req.uploadedFile (single) or req.uploadedFiles (array)
 *
 * Field name standard: "file" (single), "files" (multiple)
 */

'use strict';

const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const AppError   = require('../utils/AppError');
const logger     = require('../config/logger');
const streamifier = require('streamifier');

/* ── Configure Cloudinary from env ── */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ── Allowed MIME types ── */
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/* ── Multer: memory storage, 20 MB limit ── */
const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },  // 20 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `File type "${file.mimetype}" is not allowed. Accepted: PDF, JPG, PNG, WebP, DOC, DOCX.`,
          400
        ),
        false
      );
    }
  },
});

/* ── Magic Byte Signatures ───────────────────────────────────────────────
   Maps each allowed MIME type to one or more known file signatures (first
   N bytes of a valid file of that type). The buffer check runs AFTER multer
   fills req.file.buffer, so we read actual file content — not the browser-
   declared Content-Type, which an attacker can freely spoof.
   ──────────────────────────────────────────────────────────────────────── */
const MAGIC_SIGNATURES = {
  'image/jpeg': [(b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF],
  'image/jpg':  [(b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF],
  'image/png':  [(b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47],
  // WebP: starts RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  'image/webp': [(b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
                        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50],
  // %PDF
  'application/pdf': [(b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46],
  // DOC: Compound Binary File (D0 CF 11 E0)
  'application/msword': [(b) => b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0],
  // DOCX: ZIP archive (PK = 50 4B 03 04)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    [(b) => b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04],
};

/**
 * validateMagicBytes
 * Reads the first 12 bytes of a file buffer and checks them against the
 * known magic byte signatures for the declared MIME type.
 *
 * Returns true if the buffer matches at least one signature for that MIME type.
 * Returns false if no signatures match (potential MIME spoofing attack).
 *
 * @param {Buffer} buffer      - File buffer (from multer memoryStorage)
 * @param {string} mimeType    - Declared MIME type (from Content-Type header)
 * @returns {boolean}
 */
const validateMagicBytes = (buffer, mimeType) => {
  if (!buffer || buffer.length < 4) return false;
  const sigs = MAGIC_SIGNATURES[mimeType];
  if (!sigs) return false;  // MIME type not in our known-safe map
  return sigs.some((check) => {
    try { return check(buffer); } catch { return false; }
  });
};

/* ── Multer error handler wrapper ── */
const multerErrorHandler = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (!err) return next();
    /* Unexpected field → silently ignore, proceed without file */
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next();
    }
    /* File too large */
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File is too large. Maximum size is 20 MB.', 400));
    }
    next(err);
  });
};

/* ── Stream a Buffer to Cloudinary ── */
const streamToCloudinary = (buffer, options) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });

/* ── Upload a single multer file object to Cloudinary ── */
const uploadToCloudinary = async (file) => {
  const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';
  const result = await streamToCloudinary(file.buffer, {
    folder:        'arogyaai/records',
    resource_type: resourceType,
    public_id:     `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
    use_filename:  true,
    overwrite:     false,
  });
  return result;
};

/* ════════════════════════════════════════
   uploadFile — single file, field name "file"
   ════════════════════════════════════════ */
const uploadFile = [
  /* Step 1: parse multipart — unknown fields are silently ignored */
  multerErrorHandler(multerInstance.single('file')),

  /* Step 2: magic byte check + upload to Cloudinary */
  async (req, res, next) => {
    try {
      if (!req.file) return next(); // file is optional

      /* ── Magic byte validation (CRIT-02)
         Verify the actual file content matches the declared MIME type.
         file.mimetype is browser-supplied and fully attacker-controlled.
         This check reads the real file bytes to prevent MIME spoofing. ── */
      if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
        return next(new AppError(
          'File content does not match its declared type. Upload a valid PDF, image, or document.',
          400
        ));
      }

      if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your_cloud_name') {
        logger.warn('Cloudinary not configured — file stored as buffer only');
        req.uploadedFile = {
          secure_url:   null,
          public_id:    null,
          original_filename: req.file.originalname,
          bytes:        req.file.size,
          format:       req.file.mimetype.split('/')[1],
          mimetype:     req.file.mimetype,
          originalname: req.file.originalname,
          _buffer:      req.file.buffer,   // keep buffer for extraction step
        };
        return next();
      }

      const result = await uploadToCloudinary(req.file);
      req.uploadedFile = {
        secure_url:        result.secure_url,
        public_id:         result.public_id,
        original_filename: req.file.originalname,
        bytes:             result.bytes,
        format:            result.format,
        mimetype:          req.file.mimetype,
        originalname:      req.file.originalname,
        _buffer:           req.file.buffer, // keep buffer for extraction step
      };
      logger.info(`File uploaded to Cloudinary: ${result.public_id}`);
      next();
    } catch (err) {
      logger.error('Cloudinary upload error:', err.message);
      next(new AppError('File upload to cloud storage failed. Please try again.', 500));
    }
  },

  /* Step 3: text extraction + AI analysis (non-blocking on failure) */
  async (req, res, next) => {
    const file = req.uploadedFile;
    if (!file || !file._buffer) return next();

    const { mimetype, originalname } = file;
    const EXTRACTABLE = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!EXTRACTABLE.includes(mimetype)) {
      delete file._buffer; // free memory
      return next();
    }

    try {
      const medicalSvc = require('../services/medicalAnalysis.service');
      const recordType  = req.body?.type || 'other';

      logger.info(`Starting medical extraction for "${originalname}" (${mimetype})`);

      const result = await medicalSvc.analyzeDocument(file._buffer, mimetype, recordType);

      /* Attach to req.uploadedFile so record.service saves it */
      file.extractedText    = result.extractedText;
      file.extractionMethod = result.extractionMethod;
      file.ocrConfidence    = result.ocrConfidence;
      file.pageCount        = result.pageCount;
      file.analysis         = result.analysis;

      logger.info(`Extraction done — method=${result.extractionMethod}, chars=${result.extractedText?.length}, severity=${result.analysis?.severity}`);
    } catch (err) {
      /* Non-fatal — record is still saved without analysis */
      logger.error(`Medical extraction error for "${originalname}": ${err.message}`);
    } finally {
      delete file._buffer; // always free the buffer
    }

    next();
  },
];

/* ════════════════════════════════════════
   uploadFiles — multiple files (up to 5), field name "files"
   ════════════════════════════════════════ */
const uploadFiles = [
  /* Step 1: parse multipart — wrapped to convert MulterErrors to AppErrors.
     Without the wrapper, LIMIT_FILE_SIZE and LIMIT_UNEXPECTED_FILE bubble
     up as raw MulterError objects, leaking implementation details to clients. */
  multerErrorHandler(multerInstance.array('files', 5)),

  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) return next();

      /* ── Magic byte validation (CRIT-02) — validate every file in the batch ── */
      for (const f of req.files) {
        if (!validateMagicBytes(f.buffer, f.mimetype)) {
          return next(new AppError(
            `File "${f.originalname}" content does not match its declared type. Upload valid PDFs or images only.`,
            400
          ));
        }
      }

      const notConfigured =
        !process.env.CLOUDINARY_CLOUD_NAME ||
        process.env.CLOUDINARY_CLOUD_NAME === 'your_cloud_name';

      if (notConfigured) {
        req.uploadedFiles = req.files.map((f) => ({
          secure_url: null, public_id: null,
          original_filename: f.originalname,
          bytes: f.size, format: f.mimetype.split('/')[1],
          mimetype: f.mimetype, originalname: f.originalname,
        }));
        return next();
      }

      req.uploadedFiles = await Promise.all(req.files.map(async (f) => {
        const r = await uploadToCloudinary(f);
        return {
          secure_url:        r.secure_url,
          public_id:         r.public_id,
          original_filename: f.originalname,
          bytes:             r.bytes,
          format:            r.format,
          mimetype:          f.mimetype,
          originalname:      f.originalname,
        };
      }));

      logger.info(`${req.uploadedFiles.length} file(s) uploaded to Cloudinary`);
      next();
    } catch (err) {
      logger.error('Cloudinary multi-upload error:', err.message);
      next(new AppError('File upload to cloud storage failed.', 500));
    }
  },
];

/* ════════════════════════════════════════
   uploadFilePreview — single file for extract-preview endpoint.
   Uploads to Cloudinary but PRESERVES buffer for controller extraction.
   Does NOT run AI analysis in middleware (controller does it).
   ════════════════════════════════════════ */
const uploadFilePreview = [
  /* Step 1: parse multipart */
  multerErrorHandler(multerInstance.single('file')),

  /* Step 2: magic byte check + upload to Cloudinary + keep buffer for extraction */
  async (req, res, next) => {
    try {
      if (!req.file) return next();

      /* ── Magic byte validation (CRIT-02) ── */
      if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
        return next(new AppError(
          'File content does not match its declared type. Upload a valid PDF, image, or document.',
          400
        ));
      }

      if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your_cloud_name') {
        logger.warn('Cloudinary not configured — file stored as buffer only (preview mode)');
        req.uploadedFile = {
          secure_url:        null,
          public_id:         null,
          original_filename: req.file.originalname,
          bytes:             req.file.size,
          format:            req.file.mimetype.split('/')[1],
          mimetype:          req.file.mimetype,
          originalname:      req.file.originalname,
          _buffer:           req.file.buffer, // KEPT — controller does extraction
        };
        return next();
      }

      const result = await uploadToCloudinary(req.file);
      req.uploadedFile = {
        secure_url:        result.secure_url,
        public_id:         result.public_id,
        original_filename: req.file.originalname,
        bytes:             result.bytes,
        format:            result.format,
        mimetype:          req.file.mimetype,
        originalname:      req.file.originalname,
        _buffer:           req.file.buffer, // KEPT — controller does extraction
      };
      logger.info(`Preview file uploaded to Cloudinary: ${result.public_id}`);
      next();
    } catch (err) {
      logger.error('Cloudinary preview upload error:', err.message);
      next(new AppError('File upload to cloud storage failed. Please try again.', 500));
    }
  },
];

module.exports = { uploadFile, uploadFiles, uploadFilePreview };
