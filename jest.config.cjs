/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  verbose: true,
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/dist/', '/coverage/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/dist/'],
  coveragePathIgnorePatterns: ['/node_modules/', '/.next/', '/dist/', '/coverage/'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2023',
          module: 'node16',
          moduleResolution: 'node16',
          rootDir: '.',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
};
