import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Config base compartida por /domain, /backend e /infra. */
export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
});
