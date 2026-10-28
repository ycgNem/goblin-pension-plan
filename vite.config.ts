import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  // A port of its own, so it doesn't collide with other Vite projects on 5173.
  server: { port: 5180 },
  test: { include: ['tests/**/*.test.ts'] },
});
