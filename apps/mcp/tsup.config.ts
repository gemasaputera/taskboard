import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  sourcemap: true,
  noExternal: ['@kanban/shared'],
  banner: { js: '#!/usr/bin/env node' },
});
