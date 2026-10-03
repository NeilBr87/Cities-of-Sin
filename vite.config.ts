import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Root-relative so the config needs no Node types.
  resolve: { alias: { '@': '/src' } },
  server: { port: 5173 },
});
