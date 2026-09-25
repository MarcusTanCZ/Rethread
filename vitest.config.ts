import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so tests never load the single file build plugin.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
