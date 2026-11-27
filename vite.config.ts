import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// Número da versão do app (package.json), mostrado em Meu perfil e na tela de login.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
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
