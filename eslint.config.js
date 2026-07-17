import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: 'readonly',
        browser: 'readonly',
      },
      ecmaVersion: 2022,
      // The extension files are classic scripts (no "type": "module" in the
      // manifest), so import/export in them must be a lint error.
      sourceType: 'script',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
    },
  },
  {
    files: ['eslint.config.js'],
    languageOptions: { sourceType: 'module' },
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  },
];
