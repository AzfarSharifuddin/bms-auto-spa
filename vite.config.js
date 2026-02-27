import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        status: resolve(__dirname, 'pages/status.html'),
        login: resolve(__dirname, 'pages/login.html'),
        dashboard: resolve(__dirname, 'pages/dashboard.html'),
        admin: resolve(__dirname, 'pages/admin.html'),
      },
    },
  },
});
