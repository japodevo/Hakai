import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Relative base so the built app works when opened from any path (and from a
// home-screen install). The service worker precaches the shell + every bathy
// tile so the app opens with zero connectivity at the dock.
export default defineConfig({
  base: './',
  server: { host: true },          // reachable from the phone on the LAN in dev
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Hakai Structure Finder',
        short_name: 'Hakai',
        description: 'Offline fishing structure finder — Hakai Passage. Not for navigation.',
        theme_color: '#0b1622',
        background_color: '#0b1622',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Precache the shell + the gzipped bathy tiles + manifest. Tiles are
        // small (~6-9 MB total) so full precache is fine for offline.
        globPatterns: ['**/*.{js,css,html,svg,json,gz}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
      // Keep the SW OFF in dev (avoids stale-cache confusion while iterating).
      // Offline is validated with `npm run build && npm run preview` (and M6).
      devOptions: { enabled: false },
    }),
  ],
})
