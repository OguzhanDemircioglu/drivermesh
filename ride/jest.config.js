// Fleet'in eşi — bkz fleet/jest.config.js.
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '/.expo/',
    '/plugins/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
