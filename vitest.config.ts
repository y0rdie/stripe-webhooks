import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        '**/node_modules/**',
        '**/.{git,cache}/**',
        '**/*.d.ts',
        '**/vitest.config.*',
        '**/.{eslint,babel,prettier}rc.{js,cjs,yml,yaml}',
      ],
    },
  },
});