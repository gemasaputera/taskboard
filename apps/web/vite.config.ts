import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * In production the API serves `landing.html` for `/` (see apps/api/src/app.ts).
 * Mirror that in `vite dev` and `vite preview` so the marketing page can be
 * checked locally without running the API.
 */
function landingAtRoot(): Plugin {
  const rewrite = (req: { url?: string }) => {
    const [pathname, search] = (req.url ?? '/').split('?');
    if (pathname === '/') {
      req.url = `/landing.html${search ? `?${search}` : ''}`;
    }
  };

  return {
    name: 'kanban:landing-at-root',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), landingAtRoot()],
  resolve: {
    alias: {
      '@kanban/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        landing: fileURLToPath(new URL('./landing.html', import.meta.url)),
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('react-router') ||
            id.includes('@remix-run') ||
            id.includes('use-sync-external-store')
          ) {
            return 'vendor-react';
          }
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('@dnd-kit')) return 'vendor-dnd';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: false,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
      },
      '/oauth': {
        target: 'http://localhost:4000',
        changeOrigin: false,
      },
      '/.well-known': {
        target: 'http://localhost:4000',
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
  },
});
