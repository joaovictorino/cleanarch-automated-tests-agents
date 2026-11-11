/** Jest com next/jest (SWC): testes em TypeScript direto de src/, sem build prévio. */
const nextJest = require('next/jest');

const criarConfig = nextJest({ dir: __dirname });

module.exports = criarConfig({
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/support/isolamento.ts'],
  clearMocks: true,
});
