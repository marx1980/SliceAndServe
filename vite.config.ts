import { defineConfig } from 'vitest/config';

// base './' keeps asset URLs relative so the build works under a GitHub Pages subpath.
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['src/tests/**/*.test.ts'],
    environment: 'node',
  },
});
