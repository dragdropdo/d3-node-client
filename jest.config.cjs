/**
 * Jest configuration for the D3 Node client.
 * Uses ts-jest to compile TypeScript test files on the fly.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  clearMocks: true,
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/"],
};

