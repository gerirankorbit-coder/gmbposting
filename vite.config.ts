import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // `npm run dev:api` serves the Hono app on :3001; `vercel dev` serves both itself.
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
