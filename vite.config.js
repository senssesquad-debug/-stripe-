import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { copyFile, mkdir, readFile } from 'node:fs/promises'

const origin = process.env.JZ_ORIGIN || 'https://www.jzbarbershop.com'

// Static hosts have no SPA rewrites. Besides 404.html, every public route gets
// its own copy of the app shell, so deep links such as /lv/dpils-alejas/prices
// open directly even when the site lives in a sub-folder.
const spaFallback = () => ({
  name: 'spa-fallback',
  apply: 'build',
  async closeBundle() {
    await copyFile('dist/index.html', 'dist/404.html')
    const snapshot = JSON.parse(await readFile('src/data/snapshot.json', 'utf8'))
    const pages = ['home', 'team', 'services', 'prices', 'contacts', 'booking', 'privacy-policy']
    for (const dept of snapshot.departmentCodes) {
      for (const lang of ['lv', 'en', 'ru']) {
        for (const page of pages) {
          const dir = `dist/${lang}/${dept}/${page}`
          await mkdir(dir, { recursive: true })
          await copyFile('dist/index.html', `${dir}/index.html`)
        }
      }
    }
  },
})

// Preview copies (e.g. GitHub Pages) must not compete with jzbarbershop.com in search.
const previewNoindex = () => ({
  name: 'preview-noindex',
  transformIndexHtml(html) {
    if (!process.env.VITE_PREVIEW) return html
    return html.replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <meta name="robots" content="noindex, nofollow" />')
  },
})

export default defineConfig({
  // e.g. VITE_BASE=/jz-barbershop/ when published under a sub-path
  base: process.env.VITE_BASE || '/',
  plugins: [vue(), previewNoindex(), spaFallback()],
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
