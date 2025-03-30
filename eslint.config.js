import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**'],
  },
  {
    rules: {
      'quotes': ['error', 'single'],
      'indent': ['error', 2, { 'SwitchCase': 0 }],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
      'dot-notation': 'error',
      'eqeqeq': ['error', 'smart'],
      'brace-style': ['error'],
      'prefer-arrow-callback': 'warn',
      'max-len': ['warn', 160],
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': ['error', { 'classes': false, 'enums': false }],
      '@typescript-eslint/no-unused-vars': ['error', { 'caughtErrors': 'none' }],
    },
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
);
