import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'SkyRail L17 · Manutenção',
        short_name: 'SkyRail L17',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#111827',
        theme_color: '#1f2937',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        // Só o shell do app vai para o cache. Dados do Supabase não são
        // cacheados pelo service worker; o offline de dados usa a fila em IndexedDB.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
