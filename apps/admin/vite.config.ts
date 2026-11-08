import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Built into dist/ and served by the API at /admin/ (ADMIN_STATIC_DIR). In dev, /v1 is proxied to the API.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: { port: 5173, proxy: { '/v1': process.env.VITE_API_PROXY ?? 'http://localhost:8080' } },
});
