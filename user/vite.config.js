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
        name: 'AttendanceHub - Employee',
        short_name: 'AH Employee',
        description: 'Check your attendance and manage your profile',
        theme_color: '#06B6D4',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        screenshots: [
          {
            src: '/screenshots/employee-mobile-1.png',
            sizes: '540x720',
            form_factor: 'narrow',
            type: 'image/png'
          },
          {
            src: '/screenshots/employee-mobile-2.png',
            sizes: '540x720',
            form_factor: 'narrow',
            type: 'image/png'
          },
          {
            src: '/screenshots/employee-desktop-1.png',
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
            name: 'My Attendance',
            short_name: 'Attendance',
            description: 'Check your attendance status',
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
            name: 'Home',
            short_name: 'Home',
            description: 'Go to home page',
            url: '/home',
            icons: [
              {
                src: '/shortcuts/home-96.png',
                sizes: '96x96',
                type: 'image/png'
              }
            ]
          },
          {
            name: 'Profile',
            short_name: 'Profile',
            description: 'View your profile',
            url: '/profile',
            icons: [
              {
                src: '/shortcuts/profile-96.png',
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
          // Cache API responses - NetworkFirst for fresh data
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
      strategies: 'auto'
    })
  ],
  server: {
    port: 5902,
    proxy: {
      '/api': 'http://localhost:5900'
    }
  }
})
