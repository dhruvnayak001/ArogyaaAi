/**
 * src/index.js
 * ArogyaAI Backend — Express application entry point
 * Sets up security middleware, routes, error handling, and DB connection
 */

'use strict';

const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const cookieParser   = require('cookie-parser');
const morgan         = require('morgan');
const mongoSanitize  = require('express-mongo-sanitize');
const rateLimit      = require('express-rate-limit');
const hpp            = require('hpp');
require('dotenv').config();

/* ════════════════════════════════════════
   STARTUP ENVIRONMENT VALIDATION
   Must run before any module reads process.env
   ════════════════════════════════════════ */

/**
 * validateEnv
 * Checks that all required environment variables are present and meet
 * minimum security requirements. Calls process.exit(1) with a clear
 * diagnostic message if any check fails.
 *
 * Production justification: A deploy with a missing JWT secret makes
 * all tokens forgeable. A missing Razorpay secret makes payment
 * verification bypassable. The server must refuse to start rather than
 * silently serve traffic in a broken security posture.
 */
const validateEnv = () => {
  const REQUIRED = [
    'MONGODB_URI',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'COOKIE_SECRET',
    'GEMINI_API_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'EMAIL_HOST',
    'EMAIL_USER',
    'EMAIL_PASS',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'OTP_PEPPER',
  ];

  /* Placeholder values that indicate an unconfigured deploy */
  const PLACEHOLDER_PATTERNS = [
    /^your_/i,
    /^change_this/i,
    /^<.*>$/,
    /^xxx/i,
    /^placeholder/i,
  ];

  /* Secrets that must meet a minimum character length */
  const MIN_SECRET_LENGTH = {
    JWT_ACCESS_SECRET:  32,
    JWT_REFRESH_SECRET: 32,
    COOKIE_SECRET:      32,
  };

  const missing   = [];
  const insecure  = [];

  for (const key of REQUIRED) {
    const val = process.env[key];
    if (!val || val.trim() === '') {
      missing.push(key);
      continue;
    }
    /* Reject known placeholder patterns */
    if (PLACEHOLDER_PATTERNS.some((re) => re.test(val))) {
      insecure.push(`${key} appears to be a placeholder value`);
      continue;
    }
    /* Enforce minimum length on secrets */
    if (MIN_SECRET_LENGTH[key] && val.length < MIN_SECRET_LENGTH[key]) {
      insecure.push(`${key} must be at least ${MIN_SECRET_LENGTH[key]} characters (got ${val.length})`);
    }
  }

  /* Production-specific: Redis is mandatory for reliable queue/refund processing */
  if (process.env.NODE_ENV === 'production' && (!process.env.REDIS_URL || process.env.REDIS_URL.trim() === '')) {
    missing.push('REDIS_URL (required in production for queue reliability)');
  }

  if (missing.length > 0 || insecure.length > 0) {
    /* Use console.error here — logger may not be initialized yet */
    console.error('\n❌ [ArogyaAI] SERVER STARTUP ABORTED — environment configuration error:\n');
    if (missing.length  > 0) console.error('  Missing variables:\n   ', missing.join('\n    '));
    if (insecure.length > 0) console.error('  Security violations:\n   ', insecure.join('\n    '));
    console.error('\n  → Copy server/.env.example to server/.env and fill in all values.\n');
    process.exit(1);
  }
};

validateEnv();

const connectDB      = require('./config/db');
const logger         = require('./config/logger');
const errorHandler   = require('./middleware/errorHandler');
const notFound       = require('./middleware/notFound');

/* ── Route imports ── */
const authRoutes             = require('./routes/auth.routes');
const userRoutes             = require('./routes/user.routes');
const chatRoutes             = require('./routes/chat.routes');
const appointmentRoutes      = require('./routes/appointment.routes');
const recordRoutes           = require('./routes/record.routes');
const doctorRoutes           = require('./routes/doctor.routes');
const emergencyRoutes        = require('./routes/emergency.routes');
const aiRoutes               = require('./routes/ai.routes');
const notificationRoutes     = require('./routes/notification.routes');
const paymentRoutes          = require('./routes/payment.routes');
/* Models loaded here to ensure Mongoose registers all schemas at startup */
require('./models/User.model');
require('./models/ChatSession.model');
require('./models/Appointment.model');
require('./models/HealthRecord.model');
require('./models/Otp.model');           // TTL index registered at startup
require('./models/Notification.model'); // registers Notification schema + TTL
require('./models/WebhookEvent.model'); // registers WebhookEvent schema + TTL

/* ── Connect to MongoDB ── */
connectDB().then(() => {
  /* Initialize cron jobs AFTER DB connection is ready */
  const { initCron } = require('./services/cron.service');
  initCron();

  /* Initialise BullMQ queues + start background workers.
     Both are safe no-ops when REDIS_URL is not set — jobs run inline. */
  const { initQueues } = require('./queues');
  initQueues();

  const { startEmailWorker }        = require('./queues/workers/email.worker');
  const { startNotificationWorker } = require('./queues/workers/notification.worker');
  const { startAiWorker }           = require('./queues/workers/ai.worker');
  const { startRefundWorker }       = require('./queues/workers/refund.worker');
  startEmailWorker();
  startNotificationWorker();
  startAiWorker();
  startRefundWorker();

  if (!process.env.REDIS_URL) {
    logger.warn(
      '[Startup] REDIS_URL not configured — refunds will be processed inline with NO automatic ' +
      'retry/backoff. Configure REDIS_URL in production for reliable refund processing.'
    );
  }

  /* Non-blocking SMTP connectivity check — warns if email is misconfigured
     without preventing server startup. Failure here means OTP/appointment
     emails won't send until the SMTP config is corrected. */
  const { verifySmtp } = require('./utils/sendEmail');
  verifySmtp().catch(() => {}); // errors already logged inside verifySmtp
});

const app = express();
const API_PREFIX = '/api/v1';

/* ════════════════════════════════════════
   SECURITY MIDDLEWARE
   ════════════════════════════════════════ */

// Set security HTTP headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  /* Explicit HSTS: 2-year max-age, includeSubDomains, preload-eligible.
     Helmet v8 enables HSTS by default but explicit config makes the
     policy auditable and ensures no future Helmet upgrade can silently
     change the directive values. Submit to hstspreload.org after deploy. */
  hsts: {
    maxAge:            63072000, // 2 years in seconds (HSTS preload requirement)
    includeSubDomains: true,
    preload:           true,
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'"],
      styleSrc:      ["'self'", "'unsafe-inline'"],
      imgSrc:        ["'self'", 'data:', 'https:'],
      /* Prevent this API from being embedded in any frame or iframe.
         Defends against clickjacking; replaces the legacy X-Frame-Options header
         which Helmet already sets but CSP frame-ancestors takes precedence in
         modern browsers. The value 'none' is equivalent to X-Frame-Options: DENY. */
      frameAncestors: ["'none'"],
    },
  },
}));

// CORS — allow frontend origin + credentials
// Development ports (3001-3003) are only included outside production to prevent
// localhost origins from making credentialed requests to a production server.
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  ...(process.env.NODE_ENV !== 'production' ? [
    'http://localhost:3001',
    'http://localhost:3002',   // Vite fallback ports
    'http://localhost:3003',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ] : []),
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    /* Allow requests with no origin header (curl, mobile apps, Postman).
       NOTE: the literal string 'null' is what browsers send for sandboxed iframes
       and file:// requests — that is NOT the same as an absent origin header and
       must be rejected to prevent credentialed requests from those contexts. */
    if (!origin) return callback(null, true);
    if (origin === 'null') return callback(new Error('CORS policy: null origin not allowed'));
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS policy: origin '${origin}' not allowed`));
  },
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
}));

/* ── Optional: Redis-backed distributed rate limiting ──────────────────────
   Set REDIS_URL in .env to share rate-limit counters across multiple server
   instances (horizontal scaling). Without REDIS_URL, all limiters use the
   default in-memory store — correct for single-instance or local dev.      */
let makeRateLimitStore = () => undefined; // default: in-memory store

if (process.env.REDIS_URL) {
  try {
    const { RedisStore }     = require('rate-limit-redis');
    const { getRedisClient } = require('./config/redis');
    const redisClient        = getRedisClient();

    makeRateLimitStore = (prefix) => new RedisStore({
      /* ioredis command dispatcher: maps ('SET', key, val, ...) to client.set(key, val, ...) */
      sendCommand: (...args) => {
        const [cmd, ...rest] = args;
        return redisClient[cmd.toLowerCase()](...rest);
      },
      prefix: `rl:${prefix}:`,
    });

    logger.info('[RateLimit] Redis-backed distributed rate limiting enabled');
  } catch (e) {
    logger.warn(`[RateLimit] Redis store unavailable (${e.message}) — falling back to in-memory`);
  }
}

/* passOnStoreError: true makes every limiter below FAIL OPEN when its Redis
   store errors (connection drop, failover, timeout) — the request proceeds
   without a rate-limit check instead of the store's error propagating into
   Express's error handler as a 500. Without this, a transient Redis blip
   turns rate limiting on '/api' (mounted ahead of every route) into a full
   API outage for every user, on every endpoint, simultaneously. Losing rate
   limiting for the duration of a Redis hiccup is an acceptable trade-off;
   losing the entire API is not. */
const RATE_LIMIT_DEFAULTS = { passOnStoreError: true };

// Global rate limiter
const globalLimiter = rateLimit({
  ...RATE_LIMIT_DEFAULTS,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      300,
  message:  { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders:   false,
  store:           makeRateLimitStore('global'),
});
app.use('/api', globalLimiter);

// Auth-specific stricter limiter (login, register, forgot-password)
const authLimiter = rateLimit({
  ...RATE_LIMIT_DEFAULTS,
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  { success: false, message: 'Too many auth attempts. Please try again later.' },
  store:    makeRateLimitStore('auth'),
});

// Refresh endpoint gets its own stricter limiter.
// Prevents the refresh path (called silently by the Axios interceptor)
// from consuming the login budget and also limits brute-force on refresh tokens.
const refreshLimiter = rateLimit({
  ...RATE_LIMIT_DEFAULTS,
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { success: false, message: 'Too many token refresh attempts. Please log in again.' },
  standardHeaders: true,
  legacyHeaders:   false,
  store:           makeRateLimitStore('refresh'),
});

// AI endpoints limiter (Gemini quota protection)
const aiLimiter = rateLimit({
  ...RATE_LIMIT_DEFAULTS,
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  { success: false, message: 'Too many AI requests. Please wait before generating another brief.' },
  standardHeaders: true,
  legacyHeaders:   false,
  store:           makeRateLimitStore('ai'),
});

// Chat endpoints limiter (Gemini quota protection — chat runs the full
// model fallback chain per message, so it must not rely on the generic
// globalLimiter budget alone, or a single chatty user can exhaust the
// shared daily Gemini quota for the whole application).
const chatLimiter = rateLimit({
  ...RATE_LIMIT_DEFAULTS,
  windowMs: 15 * 60 * 1000,
  max:      60,
  message:  { success: false, message: 'Too many chat messages. Please slow down.' },
  standardHeaders: true,
  legacyHeaders:   false,
  store:           makeRateLimitStore('chat'),
});

// Upload / extract-preview limiter
const uploadLimiter = rateLimit({
  ...RATE_LIMIT_DEFAULTS,
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { success: false, message: 'Upload limit reached. Please wait a few minutes before uploading again.' },
  standardHeaders: true,
  legacyHeaders:   false,
  store:           makeRateLimitStore('upload'),
});

// Payment limiter — prevent brute-force
const paymentLimiter = rateLimit({
  ...RATE_LIMIT_DEFAULTS,
  windowMs: 15 * 60 * 1000,
  max:      60,
  message:  { success: false, message: 'Too many payment requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders:   false,
  store:           makeRateLimitStore('payment'),
});

/* ════════════════════════════════════════
   RAZORPAY WEBHOOK — raw body required for HMAC signature verification.
   Must be registered BEFORE the global express.json() parser below (Express
   matches middleware/routes in registration order, so this path gets the
   raw Buffer instead of the globally-parsed JSON body). Mounted directly on
   `app` rather than through payment.routes.js because that router applies
   `protect` (JWT auth) to everything — Razorpay has no JWT; the HMAC
   signature check inside the controller IS the authentication here. The
   global express.json() below is untouched and still parses every other route. */
app.post(
  `${API_PREFIX}/payments/webhook`,
  express.raw({ type: 'application/json', limit: '512kb' }),
  require('./controllers/webhook.controller').handleRazorpayWebhook
);

/* ════════════════════════════════════════
   BODY PARSING & SANITATION
   ════════════════════════════════════════ */
/* JSON body limit: 512 KB is sufficient for all API payloads.
   File uploads bypass this entirely — they use multer (multipart/form-data)
   which has its own separate 20 MB per-file limit in upload.middleware.js. */
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(mongoSanitize());  // Prevent NoSQL injection
app.use(hpp());            // Prevent HTTP parameter pollution

/* ════════════════════════════════════════
   LOGGING
   ════════════════════════════════════════ */
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

/* ════════════════════════════════════════
   HEALTH CHECK
   ════════════════════════════════════════ */
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'ArogyaAI API',
    version: '1.0.0',
    status:  'healthy',
    timestamp: new Date().toISOString(),
  });
});

/* ════════════════════════════════════════
   READINESS PROBE
   Checks all external dependencies before accepting live traffic.
   Returns 200 when every mandatory dependency is reachable, 503 otherwise.
   Used by Kubernetes / ECS readinessProbe / load-balancer health checks.
   ════════════════════════════════════════ */
app.get('/readiness', async (_req, res) => {
  const checks  = {};
  let   healthy = true;

  /* ── MongoDB ── */
  try {
    const mongoose = require('mongoose');
    /* readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting */
    const mongoState = mongoose.connection.readyState;
    if (mongoState === 1) {
      /* Lightweight ping — does not scan any collection */
      await mongoose.connection.db.admin().ping();
      checks.mongodb = { status: 'ok' };
    } else {
      checks.mongodb = { status: 'degraded', detail: `readyState=${mongoState}` };
      healthy = false;
    }
  } catch (e) {
    checks.mongodb = { status: 'error', detail: e.message };
    healthy = false;
  }

  /* ── Gemini API ── */
  try {
    const { genAI, MODEL_CHAIN: MC } = require('./config/gemini');
    if (!process.env.GEMINI_API_KEY) {
      checks.gemini = { status: 'unconfigured' };
      healthy = false;
    } else {
      /* countTokens on a single-word prompt is the cheapest valid API call */
      const probe = genAI.getGenerativeModel({ model: MC[0] });
      await probe.countTokens('ping');
      checks.gemini = { status: 'ok', model: MC[0] };
    }
  } catch (e) {
    /* Gemini quota/network errors during readiness should not block traffic —
       log and mark degraded but keep healthy=true; AI features degrade gracefully. */
    checks.gemini = { status: 'degraded', detail: e.message.slice(0, 120) };
  }

  /* ── Redis (only when configured) ── */
  if (process.env.REDIS_URL) {
    try {
      const { getRedisClient, isRedisReady } = require('./config/redis');
      const client = getRedisClient();
      if (!client || !isRedisReady()) {
        checks.redis = { status: 'connecting' };
        /* Redis not yet ready — not a hard failure; rate-limit falls back in-process */
      } else {
        await client.ping();
        checks.redis = { status: 'ok' };
      }
    } catch (e) {
      checks.redis = { status: 'degraded', detail: e.message.slice(0, 120) };
    }
  }

  const statusCode = healthy ? 200 : 503;
  res.status(statusCode).json({
    success:   healthy,
    status:    healthy ? 'ready' : 'not ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

/* ════════════════════════════════════════
   API ROUTES
   ════════════════════════════════════════ */
app.use(`${API_PREFIX}/auth`,          authLimiter, authRoutes);
/* Scope the refresh limiter only to the refresh sub-path so it does not
   count against the main authLimiter budget used by login/register. */
app.use(`${API_PREFIX}/auth/refresh`,  refreshLimiter);
app.use(`${API_PREFIX}/users`,         userRoutes);
app.use(`${API_PREFIX}/chat`,          chatLimiter, chatRoutes);
app.use(`${API_PREFIX}/appointments`,  appointmentRoutes);
app.use(`${API_PREFIX}/records`,       uploadLimiter, recordRoutes);
app.use(`${API_PREFIX}/doctors`,       doctorRoutes);
app.use(`${API_PREFIX}/emergency`,     emergencyRoutes);
app.use(`${API_PREFIX}/ai`,            aiLimiter, aiRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/payments`,      paymentLimiter, paymentRoutes);

/* ════════════════════════════════════════
   ERROR HANDLING
   ════════════════════════════════════════ */
app.use(notFound);
app.use(errorHandler);

/* ════════════════════════════════════════
   START SERVER
   ════════════════════════════════════════ */
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`🚀 ArogyaAI server running on port ${PORT} [${process.env.NODE_ENV}]`);
});

/* Graceful shutdown */
const shutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    /* Drain BullMQ workers before exit so in-flight jobs are not lost */
    try {
      const { stopEmailWorker }        = require('./queues/workers/email.worker');
      const { stopNotificationWorker } = require('./queues/workers/notification.worker');
      const { stopAiWorker }           = require('./queues/workers/ai.worker');
      const { stopRefundWorker }       = require('./queues/workers/refund.worker');
      await Promise.all([stopEmailWorker(), stopNotificationWorker(), stopAiWorker(), stopRefundWorker()]);
    } catch { /* workers may not have started (no Redis) — safe to ignore */ }

    /* Cooperatively close DB/Redis connections rather than relying on
       process.exit() to tear down the sockets — matters in orchestrated
       environments (k8s/ECS) that expect a clean shutdown sequence. */
    try {
      const mongoose = require('mongoose');
      await mongoose.connection.close(false);
    } catch { /* already closed / never connected */ }
    try {
      const { getRedisClient } = require('./config/redis');
      const client = getRedisClient();
      if (client) await client.quit();
    } catch { /* Redis not configured / already closed */ }

    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

/* A synchronous throw anywhere outside Express's own request cycle (a timer
   callback, a cron tick body, native-binding code) has no framework-level
   catch. Node's default behavior is to dump to stderr and hard-exit with no
   drain of in-flight requests or BullMQ workers. Route it through the same
   graceful shutdown path as unhandledRejection, with a forced-exit fallback
   in case server.close() itself hangs (e.g. a socket stuck half-open). */
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception — shutting down:', err);
  server.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 10000).unref();
});

process.on('unhandledRejection', (reason) => {
  const msg = (reason instanceof Error ? reason.message : String(reason)) || '';

  /*
   * Tesseract.js OCR worker errors fire as unhandled rejections from Worker threads.
   * These are non-fatal — the upload middleware catches OCR failure gracefully.
   * Do NOT kill the server for these; just log a warning.
   */
  const isOcrWorkerError =
    msg.includes('SetVariable') ||
    msg.includes('tesseract')   ||
    (reason?.stack || '').includes('createWorker');

  if (isOcrWorkerError) {
    logger.warn(`OCR worker non-fatal error (server continues): ${msg.slice(0, 120)}`);
    return; // do NOT crash
  }

  logger.error('Unhandled Rejection:', reason);
  server.close(() => process.exit(1));
});

module.exports = app; // For testing
