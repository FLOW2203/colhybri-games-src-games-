import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/games/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'COLHYBRI GAMES',
        short_name: 'Colhybri',
        description: '1 fait scientifique = 1 jeu',
        theme_color: '#0A0F1C',
        background_color: '#0A0F1C',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/games/',
        scope: '/games/',
        icons: [
          { src: '/games/icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/games/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/games/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*supabase.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 }
            }
          }
        ]
      }
    })
  ],
})
