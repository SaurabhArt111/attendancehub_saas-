import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      injectManifest: {
        globPatterns: [
          '**/*.{js,css,html,svg,png,ico,jpg,jpeg,gif,webp,woff,woff2,ttf,eot}'
        ]
      },
      manifest: {
        name: 'AttendanceHub - Admin',
        short_name: 'AH Admin',
        description: 'Enterprise attendance management system for administrators',
        theme_color: '#111827',
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
        ]
      },
      devOptions: {
        enabled: false,
        suppressWarnings: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\/.*/]
      }
    })
  ],
  server: {
    port: 5901,
    proxy: {
      '/api': 'http://localhost:5900'
    }
  }
})
