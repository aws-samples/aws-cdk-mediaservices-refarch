module.exports = {
  testEnvironment: "node",
  globalTeardown: "<rootDir>/test/utils/jest-global-teardown.js",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};
