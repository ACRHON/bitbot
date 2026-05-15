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
    port: 5174, // Different from production
    proxy: {
      '/api': {
        target: 'http://localhost:8788', // Point to staging worker
        changeOrigin: true,
      },
      '/webhook': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify('https://staging-bitbot.de5.net'),
  },
});