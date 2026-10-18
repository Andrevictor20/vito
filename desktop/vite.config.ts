import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8190,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_PROXY_URL || 'https://vito.rasppi.cloud',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  preview: {
    port: 8190,
    host: true,
  },
});
