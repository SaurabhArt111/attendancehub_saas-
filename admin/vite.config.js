import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'AttendanceHub - Admin',
        short_name: 'AH Admin',
        description: 'Enterprise attendance management system for administrators',
        theme_color: '#4f8ef7',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        screenshots: [
          {
            src: '/screenshots/admin-mobile-1.png',
            sizes: '540x720',
            form_factor: 'narrow',
            type: 'image/png'
          },
          {
            src: '/screenshots/admin-mobile-2.png',
            sizes: '540x720',
            form_factor: 'narrow',
            type: 'image/png'
          },
          {
            src: '/screenshots/admin-desktop-1.png',
            sizes: '1280x720',
            form_factor: 'wide',
            type: 'image/png'
          }
        ],
        categories: ['productivity', 'business'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png'
          }
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'View your attendance dashboard',
            url: '/employees',
            icons: [
              {
                src: '/shortcuts/dashboard-96.png',
                sizes: '96x96',
                type: 'image/png'
              }
            ]
          },
          {
            name: 'Mark Attendance',
            short_name: 'Attendance',
            description: 'Mark employee attendance',
            url: '/attendance',
            icons: [
              {
                src: '/shortcuts/attendance-96.png',
                sizes: '96x96',
                type: 'image/png'
              }
            ]
          },
          {
            name: 'Reports',
            short_name: 'Reports',
            description: 'View attendance reports',
            url: '/reports',
            icons: [
              {
                src: '/shortcuts/reports-96.png',
                sizes: '96x96',
                type: 'image/png'
              }
            ]
          }
        ]
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,svg,png,ico,jpg,jpeg,gif,webp,woff,woff2,ttf,eot}'
        ],
        runtimeCaching: [
          // Cache API responses
          {
            urlPattern: /^https:\/\/.*\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
              }
            }
          },
          // Cache Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          // Cache images
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true
      },
      devOptions: {
        enabled: false,
        suppressWarnings: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\/.*/]
      },
      // Disable PWA in dev environment if needed
      strategies: 'auto'
    })
  ],
  server: {
    port: 5901,
    proxy: {
      '/api': 'http://localhost:5900'
    }
  }
})
