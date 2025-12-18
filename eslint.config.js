// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import unicorn from 'eslint-plugin-unicorn';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettierConfig,
  unicorn.configs.recommended,
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

      // Allow ONLY `as const`; ban all other assertions (`as Type`, `<Type>expr`)
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression:not([typeAnnotation.typeName.name="const"])',
          message:
            'Type assertions (as Type) are disallowed. Use type guards/predicates instead. ' +
            'Exception: `as const` is allowed for literal narrowing.',
        },
        {
          selector: 'TSTypeAssertion',
          message:
            'Angle-bracket type assertions (<Type>expr) are disallowed. Use type guards/predicates instead.',
        },
      ],

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

      // ===== Unicorn Plugin =====
      'unicorn/prevent-abbreviations': [
        'error',
        {
          replacements: {
            // temp = temperature, not temporary
            temp: { temperature: true },
            attr: { attribute: true },
            attrs: { attributes: true },
            num: { number: true },
            val: { value: true },
            msg: { message: true },
            acc: { accumulator: true },
          },
        },
      ],
      'unicorn/no-null': 'off', // null has semantic meaning
      'unicorn/prefer-global-this': 'off', // window is clearer for browser code
      'unicorn/template-indent': 'off', // conflicts with Lit templates
      'unicorn/no-negated-condition': 'off', // sometimes negation is clearer
      'unicorn/prefer-ternary': 'off', // can hurt readability
      'unicorn/no-array-for-each': 'off', // forEach is fine for side effects
      'unicorn/no-array-reduce': 'off', // reduce is useful for aggregations
      'unicorn/no-array-callback-reference': 'off', // direct method refs are fine
      'unicorn/prefer-array-flat-map': 'off', // sometimes clearer with map+flat
      'unicorn/switch-case-braces': 'off', // not always needed for single statements
      'unicorn/no-array-sort': 'off', // toSorted() is ES2023, we target ES2022

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
      'unicorn/no-useless-undefined': 'off', // Tests need explicit undefined args
    },
  },
  {
    // Ignore generated files and config files
    ignores: ['**/node_modules/**', '**/dist/**', '*.config.js', '*.config.ts'],
  }
);
