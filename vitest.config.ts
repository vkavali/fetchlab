import { defineConfig } from 'vitest/config';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.{js,ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
  },
});
