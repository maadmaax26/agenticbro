/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        // Use a relaxed config for tests (same as main tsconfig but include test files)
        strict: false,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'commonjs',
        target: 'ES2022',
        skipLibCheck: true,
      },
    }],
  },
  // Collect coverage from service files
  collectCoverageFrom: [
    'services/profile-verifier/**/*.ts',
    'db/scammer-db.ts',
    '!**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // Reasonable timeout for async tests
  testTimeout: 10000,
  // Show each test name as it runs
  verbose: true,
};
