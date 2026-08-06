import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import svgr from 'vite-plugin-svgr';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['rabbit.ico', 'logo.png', 'rabbit.png'],
      manifest: {
        name: 'POS Web',
        short_name: 'POS',
        description: 'Point of Sale Web App with Offline Support',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/rabbit.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/rabbit.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/rabbit.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.destination === 'image' &&
              !url.pathname.endsWith('/favicon.ico') &&
              !url.pathname.endsWith('/rabbit.ico'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/dev/pos'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: true, // atau '0.0.0.0' biar bisa diakses dari semua IP
    port: 5177, // opsional
    allowedHosts: ['7678-118-136-58-128.ngrok-free.app'],
  },
});
