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
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/webhook': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify('https://fastbot.de5.net'),
    'import.meta.env.VITE_WEBHOOK_BASE': JSON.stringify('https://fastbot.de5.net'),
  },
});
