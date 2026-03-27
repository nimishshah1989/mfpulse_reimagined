module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(js|jsx)$': ['@swc/jest', {
      jsc: {
        parser: { syntax: 'ecmascript', jsx: true },
        transform: { react: { runtime: 'automatic' } },
      },
    }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__tests__/__mocks__/styleMock.js',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '__mocks__'],
};
