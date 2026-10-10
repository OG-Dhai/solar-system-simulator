import { defineConfig } from 'vitest/config';

// Vitest runs the unit and integration suites only.
// The browser tests in tests/e2e/ use Playwright (npm run test:e2e).
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
  },
});
