import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
      '/webhook': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify('https://bitbot-dev.hallofaiden.workers.dev'),
    'import.meta.env.VITE_APP_TITLE': JSON.stringify('[DEV] bitbot'),
  },
});