import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { copyFile } from 'node:fs/promises'

const origin = process.env.JZ_ORIGIN || 'https://www.jzbarbershop.com'

// Static hosts serve 404.html for unknown paths; giving it the app shell keeps
// deep links such as /lv/dpils-alejas/prices working without server rewrites.
const spaFallback = () => ({
  name: 'spa-fallback',
  apply: 'build',
  async closeBundle() {
    await copyFile('dist/index.html', 'dist/404.html')
  },
})

export default defineConfig({
  plugins: [vue(), spaFallback()],
  server: {
    // In development the live public API and file storage are proxied, so the
    // site renders exactly what the admin panel currently publishes.
    proxy: {
      '/api': { target: origin, changeOrigin: true },
      '/storage': { target: origin, changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          motion: ['gsap', 'lenis'],
        },
      },
    },
  },
})
