// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ===== TypeScript Strict Rules =====
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Allow type assertions for Lit/HA card patterns
      '@typescript-eslint/consistent-type-assertions': 'off',

      // Let TypeScript infer return types
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // Forbid unnecessary type annotations
      '@typescript-eslint/no-inferrable-types': [
        'error',
        {
          ignoreParameters: false,
          ignoreProperties: false,
        },
      ],

      // ===== Promise Handling =====
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],

      // ===== TypeScript Import/Export =====
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

      // Variable scoping
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',

      // ===== Unused Variables =====
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // ===== Security =====
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: false,
          allowNullish: false,
        },
      ],
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // ===== Code Quality =====
      'max-params': ['error', { max: 5 }],
      complexity: 'off', // Render functions can be complex

      // ===== Code Style =====
      'prefer-destructuring': 'off', // Not always clearer
      'object-shorthand': ['error', 'always'],

      // Allow unbound methods for Lit event handlers
      '@typescript-eslint/unbound-method': 'off',
      // Allow || for default values
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      // Allow void expressions in arrow functions
      '@typescript-eslint/no-confusing-void-expression': 'off',
      // Allow unnecessary conditions (helps with optional chaining)
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // Allow String() on objects (HA attributes can be any type)
      '@typescript-eslint/no-base-to-string': 'off',
    },
  },
  {
    // Test files - relaxed rules
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Ignore generated files and config files
    ignores: ['**/node_modules/**', '**/dist/**', '*.config.js', '*.config.ts'],
  }
);
