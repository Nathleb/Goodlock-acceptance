/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.spec.ts'],
  // One disposable Postgres for the whole run; each scenario starts its own server on it.
  globalSetup: '<rootDir>/harness/global-setup.ts',
  globalTeardown: '<rootDir>/harness/global-teardown.ts',
  testTimeout: 60_000,
};
