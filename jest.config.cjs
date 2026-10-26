const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
module.exports = createJestConfig({
  verbose: true,
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/dist/', '/coverage/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/dist/'],
  coveragePathIgnorePatterns: ['/node_modules/', '/.next/', '/dist/', '/coverage/'],
});
