import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['tests/content.test.js', 'jsdom']],
    include: ['tests/**/*.test.js'],
    coverage: {
      include: ['background.js', 'content.js'],
    },
  },
});
