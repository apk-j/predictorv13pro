import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : '/predictorv13pro/',
  server: {
    host: true,
    allowedHosts: [
      'predictorv13pro.aviatorwin.co.ke',
      'opportunity-surveillance-rec-implemented.trycloudflare.com'
    ],
    proxy: {
      '/api': {
        target: mode === 'development' ? 'http://localhost:8080' : 'https://api.aviatorwin.co.ke',
        changeOrigin: true,
        secure: false
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'vite.svg',
        'icons/icon-192.svg',
        'icons/icon-512.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/apple-touch-icon.png',
        'offline.html'
      ],
      manifest: {
        name: 'Aviator Predictor V13 Pro',
        short_name: 'Aviator Pro',
        description: 'A premium Aviator prediction PWA with multi-casino connectors.',
        theme_color: '#ff0033',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallback: 'offline.html',
        runtimeCaching: [
          {
            // Avoid referencing `self` in TS config: use globalThis with any cast
            urlPattern: ({ url }) => url.origin === (globalThis as any).location?.origin,
            handler: 'CacheFirst',
            options: { cacheName: 'static-assets' }
          },
          {
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache' }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/bettingsites/'),
            handler: 'CacheFirst',
            options: { cacheName: 'site-logos' }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/bettingsites/'),
            handler: 'CacheFirst',
            options: { cacheName: 'site-logos' }
          }
        ]
      }
    })
  ],
}))
