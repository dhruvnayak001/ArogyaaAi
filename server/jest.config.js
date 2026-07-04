/**
 * jest.config.js
 *
 * Why this file exists:
 *  - Jest 30 requires explicit configuration when the test root is not the
 *    project root (our tests live in src/__tests__/, not top-level).
 *  - The project type is "commonjs" (package.json has "type": "commonjs"),
 *    so no Babel transform is needed.
 *  - The top-level test/ directory contains plain Node runner scripts
 *    (they use node test/auth.test.js, not a test framework). Those files
 *    must be excluded from Jest to avoid false "no exports" failures.
 */

'use strict';

/** @type {import('jest').Config} */
module.exports = {
  /* ── Test environment ──────────────────────────────────────────────────── */
  testEnvironment: 'node',

  /* ── Which files are tests ──────────────────────────────────────────────
     Only pick up __tests__/*.test.js inside src/.
     Explicitly exclude the top-level test/ directory — those files are
     plain Node integration scripts, not Jest tests.                        */
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.js',
    '<rootDir>/src/**/*.test.js',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/test/',          // plain Node runner scripts — not Jest tests
  ],

  /* ── Module resolution ──────────────────────────────────────────────────
     CJS project — no transform needed.                                     */
  transform: {},

  /* ── Coverage (opt-in via --coverage flag) ──────────────────────────── */
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/__tests__/**',
    '!src/index.js',            // server entry point — not unit-testable
  ],
  coverageDirectory: 'coverage',

  /* ── Globals injected into every test file ──────────────────────────── */
  testTimeout: 10000,           // 10 s — generous for mocked async operations

  /* ── Silence verbose internal logs during test runs ────────────────────
     Services import config/logger at module-load time; mock it globally.  */
  // (Each test file mocks logger individually — no global setup needed.)

  /* ── Clear mocks between test suites ────────────────────────────────── */
  clearMocks: true,
  restoreMocks: true,
};
