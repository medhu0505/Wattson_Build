// Vite settings (Vitest reads the same file).
// base: './' makes every asset path relative, so the built site works on
// GitHub Pages no matter what the repository is called.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: {
    // Our tests only check plain logic (no web page needed), so Node is enough.
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
