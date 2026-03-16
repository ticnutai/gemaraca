import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "analyze" && visualizer({
      open: true,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['robots.txt'],
      manifest: {
        name: 'תורה ומציאות - מערכת לימוד תורה מתקדמת',
        short_name: 'תורה ומציאות',
        description: 'מערכת ללימוד גמרא המחברת בין סוגיות לפסקי דין ומקרים מודרניים',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        dir: 'rtl',
        lang: 'he',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache Supabase API responses — show cached, refresh in background
            urlPattern: /^https:\/\/jaotdqumpcfhcbkgtfib\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 2 }, // 2 hours
            },
          },
          {
            // Cache Supabase Edge Functions responses
            urlPattern: /^https:\/\/jaotdqumpcfhcbkgtfib\.supabase\.co\/functions\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-functions-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 30 }, // 30 min
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache Sefaria API
            urlPattern: /^https:\/\/www\.sefaria\.org\/api\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sefaria-api-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 1 week
            },
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }, // 1 year
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query': ['@tanstack/react-query'],
          'ui-core': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-accordion',
            '@radix-ui/react-popover',
            '@radix-ui/react-scroll-area',
          ],
          'icons': ['lucide-react'],
          'supabase': ['@supabase/supabase-js'],
          'recharts': ['recharts'],
        },
      },
    },
  },
}));
