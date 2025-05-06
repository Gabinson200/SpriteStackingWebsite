/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom', // Use jsdom environment for browser-like testing
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'], // Optional setup file
    moduleNameMapper: {
      // Handle CSS module mocks or other mappings if needed
      '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
      // Alias to match tsconfig paths if you use them
      '^@/(.*)$': '<rootDir>/src/$1',
    },
    // Transform files using ts-jest
    transform: {
      '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    },
  };