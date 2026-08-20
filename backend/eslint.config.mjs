import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'prisma/generated'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['{src,apps,libs,test,api}/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // Nest relies heavily on decorators/DI where an unused constructor
      // param is normal; don't fight the framework there. `any` itself
      // stays flagged (default 'error') — every real usage in this repo
      // has been typed properly (Prisma model types, Prisma.InputJsonValue
      // for Json columns, a SetupTokenPayload interface for decoded JWTs,
      // `unknown` + instanceof/type-guards in catch blocks).
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
