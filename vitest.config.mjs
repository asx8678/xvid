import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/popup.test.js', 'jsdom'],
      ['tests/content.test.js', 'jsdom'],
    ],
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js', 'tests/**/*.test.mjs'],
    coverage: {
      include: ['background.js', 'popup.js'],
    },
  },
});
