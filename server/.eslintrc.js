/**
 * .eslintrc.js  —  ESLint 8 configuration for ArogyaAI backend
 *
 * Why .eslintrc.js and not eslint.config.js:
 *   The project uses ESLint ^8.57.x (devDependencies). The flat config
 *   (eslint.config.js) is the default only from ESLint v9+. Using the
 *   legacy .eslintrc format avoids breaking changes and stays consistent
 *   with ESLint 8's expected resolution algorithm.
 *
 * Philosophy:
 *   Rules are real — no rules are disabled simply to make the linter
 *   pass. Rules that are off are off because they conflict with the
 *   project's deliberate coding style (documented inline).
 */

'use strict';

module.exports = {
  /* ── Parser options ──────────────────────────────────────────────────── */
  parserOptions: {
    ecmaVersion: 2022,   // supports optional chaining, nullish coalescing, etc.
    sourceType:  'script', // "type": "commonjs" in package.json → CJS, not ESM
  },

  /* ── Environment ────────────────────────────────────────────────────── */
  env: {
    node:    true,   // process, require, __dirname, etc.
    es2022:  true,   // Promise, Map, Set, structuredClone, etc.
    jest:    true,   // describe, it, expect, jest — for __tests__ files
  },

  /* ── Extends ────────────────────────────────────────────────────────── */
  extends: [
    'eslint:recommended',  // catches undefined variables, unreachable code, etc.
  ],

  /* ── Rules ──────────────────────────────────────────────────────────── */
  rules: {
    /* ─ Errors / correctness ─ */
    'no-console':          'warn',   // services use Winston — console.* is accidental
    'no-unused-vars':      ['error', { vars: 'all', args: 'after-used', ignoreRestSiblings: true }],
    'no-undef':            'error',
    'no-shadow':           'warn',
    'eqeqeq':              ['error', 'always', { null: 'ignore' }],
    'no-return-assign':    'error',
    'no-throw-literal':    'error',  // must throw Error objects, not strings/objects
    'no-promise-executor-return': 'error',  // async executor anti-pattern
    'no-await-in-loop':    'warn',   // usually a performance concern; fine in test helpers

    /* ─ Async / callback safety ─ */
    'require-await':       'warn',   // flags async functions with no await inside
    'no-async-promise-executor': 'error',

    /* ─ Best practices ─ */
    'curly':               ['error', 'all'],
    'no-var':              'error',  // use const/let exclusively
    'prefer-const':        ['error', { destructuring: 'any' }],
    'object-shorthand':    ['warn', 'always'],
    'no-param-reassign':   ['warn', { props: false }], // allow obj.prop = x, ban param = x

    /* ─ Imports / modules ─ */
    'no-duplicate-imports': 'error',

    /* ─ Style (non-cosmetic only — no formatting rules; use Prettier for that) ─ */
    'strict':              ['error', 'global'],  // 'use strict' required at top of every file
  },

  /* ── Per-file overrides ─────────────────────────────────────────────── */
  overrides: [
    {
      /* Test files: relax rules that conflict with test patterns */
      files: ['src/**/__tests__/**/*.js', 'src/**/*.test.js'],
      env:   { jest: true },
      rules: {
        'no-unused-vars':    ['error', { vars: 'all', args: 'after-used', ignoreRestSiblings: true }],
        'require-await':     'off',   // test helpers are often sync; jest matchers resolve internally
        'no-param-reassign': 'off',   // mock reassignment is standard in Jest (User.find = jest.fn())
      },
    },
    {
      /* Top-level test/ runner scripts: plain Node, no framework globals */
      files: ['test/**/*.js'],
      env:   { node: true, jest: false },
      rules: {
        'no-console': 'off',   // these scripts deliberately print output
        'strict':     ['error', 'global'],
      },
    },
    {
      /* Config files at root: CJS modules, no 'use strict' required */
      files: ['*.js', '.eslintrc.js'],
      rules: {
        'strict': ['error', 'global'],
      },
    },
  ],

  /* ── Ignore patterns ────────────────────────────────────────────────── */
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'dist/',
    'build/',
  ],
};
