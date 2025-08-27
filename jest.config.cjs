module.exports = {
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  collectCoverage: true,
  collectCoverageFrom: ['packages/**/*.js(x)?', 'apps/**/*.js(x)?'],
  coverageReporters: ['lcov', 'text'],
  roots: ['<rootDir>/packages', '<rootDir>/apps'],
  testMatch: [
    "**/__tests__/**/*.+(js|jsx|ts|tsx)",
    "**/?(*.)+(spec|test).+(js|jsx|ts|tsx)"
  ],
};
