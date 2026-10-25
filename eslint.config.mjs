import js from '@eslint/js';
import globals from 'globals';

// Chrome loads both as classic scripts; import/export must stay invalid.
const extension = {
  ecmaVersion: 2022,
  sourceType: 'script',
};

export default [
  {
    ignores: ['.pi/'],
  },
  js.configs.recommended,
  {
    files: ['content.js'],
    languageOptions: { ...extension, globals: { ...globals.browser, chrome: 'readonly' } },
  },
  {
    // The service worker has no window or document; lint must say so.
    files: ['background.js'],
    languageOptions: { ...extension, globals: { ...globals.serviceworker, chrome: 'readonly' } },
  },
  {
    files: ['background.js', 'content.js'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
    },
  },
];
