import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', '.pi/', 'audit-output/'],
  },
  js.configs.recommended,
  {
    files: ['tests/**/*.cjs'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
  },
  {
    files: ['background.js', 'content.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: 'readonly',
      },
      ecmaVersion: 2022,
      // Chrome loads these as classic scripts; import/export must stay invalid.
      sourceType: 'script',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
    },
  },
];
