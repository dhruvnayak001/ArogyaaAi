/**
 * __tests__/cron.test.js
 *
 * Tests for the distributed cron lock (P1-2):
 *   - UUID token ownership on acquire
 *   - Lua compare-and-delete release (only deletes when token matches)
 *   - Concurrent instances: second acquire attempt is skipped
 */

'use strict';

jest.mock('../models/Appointment.model');
jest.mock('../config/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const fakeRedis = {
  set:  jest.fn(),
  eval: jest.fn(),
};
jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn(() => fakeRedis),
}));

const { acquireCronLock, releaseCronLock } = require('../services/cron.service');

describe('cron.service — distributed lock (UUID + Lua compare-and-delete)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('acquires the lock with SET key <uuid> NX PX ttl using a fresh UUID each call', async () => {
    fakeRedis.set.mockResolvedValueOnce('OK');
    const { acquired, token } = await acquireCronLock('cron:lock:test', 60000);

    expect(acquired).toBe(true);
    expect(token).toEqual(expect.any(String));
    /* Looks like a UUID (crypto.randomUUID format) */
    expect(token).toMatch(/^[0-9a-f-]{36}$/i);
    expect(fakeRedis.set).toHaveBeenCalledWith('cron:lock:test', token, 'NX', 'PX', 60000);
  });

  it('generates a different token on each acquire call', async () => {
    fakeRedis.set.mockResolvedValue('OK');
    const first  = await acquireCronLock('cron:lock:test', 60000);
    const second = await acquireCronLock('cron:lock:test', 60000);

    expect(first.token).not.toBe(second.token);
  });

  it('reports acquired:false when SET NX fails (another instance holds the lock)', async () => {
    fakeRedis.set.mockResolvedValueOnce(null);
    const { acquired, token } = await acquireCronLock('cron:lock:test', 60000);

    expect(acquired).toBe(false);
    expect(token).toBeNull();
  });

  it('two concurrent instances: only the first acquires', async () => {
    fakeRedis.set
      .mockResolvedValueOnce('OK')  // instance A wins
      .mockResolvedValueOnce(null); // instance B loses (key already exists)

    const a = await acquireCronLock('cron:lock:test', 60000);
    const b = await acquireCronLock('cron:lock:test', 60000);

    expect(a.acquired).toBe(true);
    expect(b.acquired).toBe(false);
  });

  it('releaseCronLock runs the compare-and-delete Lua script with the owned token', async () => {
    fakeRedis.eval.mockResolvedValueOnce(1);

    await releaseCronLock('cron:lock:test', 'my-token-123');

    expect(fakeRedis.eval).toHaveBeenCalledTimes(1);
    const [script, numKeys, key, token] = fakeRedis.eval.mock.calls[0];
    expect(script).toEqual(expect.stringContaining('redis.call("GET", KEYS[1])'));
    expect(numKeys).toBe(1);
    expect(key).toBe('cron:lock:test');
    expect(token).toBe('my-token-123');
  });

  it('does not delete the lock when the stored token no longer matches (script returns 0)', async () => {
    fakeRedis.eval.mockResolvedValueOnce(0);

    /* Should not throw — a mismatch just means another instance now owns it */
    await expect(releaseCronLock('cron:lock:test', 'stale-token')).resolves.toBeUndefined();
    expect(fakeRedis.eval).toHaveBeenCalledTimes(1);
  });

  it('releaseCronLock is a no-op when token is null (Redis was unavailable at acquire time)', async () => {
    await releaseCronLock('cron:lock:test', null);
    expect(fakeRedis.eval).not.toHaveBeenCalled();
  });

  it('acquireCronLock falls back to single-instance mode when Redis is unavailable', async () => {
    const redisConfig = require('../config/redis');
    redisConfig.getRedisClient.mockReturnValueOnce(null);

    const { acquired, token } = await acquireCronLock('cron:lock:test', 60000);
    expect(acquired).toBe(true);
    expect(token).toBeNull();
  });
});
