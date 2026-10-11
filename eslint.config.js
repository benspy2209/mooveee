//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  // Fonctions Deno (Edge Functions Supabase) : hors du projet TS du front.
  { ignores: ['supabase/functions/**', '.output/**'] },
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    ignores: ['eslint.config.js', 'prettier.config.js'],
  },
]
