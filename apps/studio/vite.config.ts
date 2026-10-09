import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiPort = Number(process.env.LMS_PORT ?? 4317);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: { '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false } },
    fs: { allow: [path.resolve(import.meta.dirname, '../..')] },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
});
