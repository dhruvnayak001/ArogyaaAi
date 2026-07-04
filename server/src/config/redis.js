/**
 * config/redis.js
 * Shared ioredis client for distributed features:
 *   - Redis-backed rate limiting (rate-limit-redis)
 *   - Distributed cron lock (SET NX PX)
 *
 * The client is only created when REDIS_URL is present in the environment.
 * When REDIS_URL is absent (local dev without Redis), getRedisClient() returns
 * null and all callers fall back to in-process behaviour.
 */

'use strict';

const Redis  = require('ioredis');
const logger = require('./logger');

let _client = null;
let _ready  = false;

/**
 * Returns the shared ioredis client, creating it on the first call.
 * Returns null if REDIS_URL is not configured.
 */
const getRedisClient = () => {
  if (!process.env.REDIS_URL) return null;
  if (_client) return _client;

  _client = new Redis(process.env.REDIS_URL, {
    lazyConnect:          true,
    enableOfflineQueue:   true,   // queue commands while connecting
    maxRetriesPerRequest: 2,      // fail a command after 2 retries
    connectTimeout:       3000,
  });

  _client.on('ready', () => {
    _ready = true;
    logger.info('[Redis] Connected successfully');
  });
  _client.on('error', (err) => {
    if (_ready) logger.warn(`[Redis] Connection error: ${err.message}`);
    _ready = false;
  });
  _client.on('reconnecting', () => {
    logger.info('[Redis] Reconnecting...');
  });

  _client.connect().catch((err) => {
    logger.warn(`[Redis] Initial connection failed (${err.message}) — distributed features will use in-process fallback`);
  });

  return _client;
};

/** True only after the 'ready' event fires (not just after connect() is called). */
const isRedisReady = () => _ready;

module.exports = { getRedisClient, isRedisReady };
