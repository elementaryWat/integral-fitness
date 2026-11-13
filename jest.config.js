module.exports = {
  preset: '@react-native/jest-preset',
  testMatch: ['**/?(*.)test.[jt]s?(x)'],
  // server/ and watch/ have their own node --test suites.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/server/', '<rootDir>/watch/'],
};
