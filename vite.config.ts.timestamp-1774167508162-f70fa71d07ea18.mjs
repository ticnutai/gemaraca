// vite.config.ts
import { defineConfig } from "file:///C:/Users/jj121/OneDrive/%D7%A9%D7%95%D7%9C%D7%97%D7%9F%20%D7%94%D7%A2%D7%91%D7%95%D7%93%D7%94/gemaraca/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/jj121/OneDrive/%D7%A9%D7%95%D7%9C%D7%97%D7%9F%20%D7%94%D7%A2%D7%91%D7%95%D7%93%D7%94/gemaraca/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/jj121/OneDrive/%D7%A9%D7%95%D7%9C%D7%97%D7%9F%20%D7%94%D7%A2%D7%91%D7%95%D7%93%D7%94/gemaraca/node_modules/lovable-tagger/dist/index.js";
import { VitePWA } from "file:///C:/Users/jj121/OneDrive/%D7%A9%D7%95%D7%9C%D7%97%D7%9F%20%D7%94%D7%A2%D7%91%D7%95%D7%93%D7%94/gemaraca/node_modules/vite-plugin-pwa/dist/index.js";
import { visualizer } from "file:///C:/Users/jj121/OneDrive/%D7%A9%D7%95%D7%9C%D7%97%D7%9F%20%D7%94%D7%A2%D7%91%D7%95%D7%93%D7%94/gemaraca/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
import { spawn } from "child_process";
var __vite_injected_original_dirname = "C:\\Users\\jj121\\OneDrive\\\u05E9\u05D5\u05DC\u05D7\u05DF \u05D4\u05E2\u05D1\u05D5\u05D3\u05D4\\gemaraca";
function ocrServerLauncher() {
  let ocrProcess = null;
  const SCRIPT = path.resolve(
    process.env.USERPROFILE || process.env.HOME || ".",
    ".vscode/extensions/terminal-monitor/ocr-server/server.py"
  );
  return {
    name: "ocr-server-launcher",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/api/ocr-launcher/start" && req.method === "POST") {
          if (ocrProcess && !ocrProcess.killed) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "already_running", pid: ocrProcess.pid }));
            return;
          }
          try {
            const child = spawn("python", [SCRIPT, "--port", "8399"], {
              stdio: ["ignore", "pipe", "pipe"],
              detached: false,
              windowsHide: true
            });
            ocrProcess = child;
            child.stdout?.on("data", (d) => {
              const msg = d.toString().trim();
              if (msg) console.log(`[OCR] ${msg}`);
            });
            child.stderr?.on("data", (d) => {
              const msg = d.toString().trim();
              if (msg) console.log(`[OCR] ${msg}`);
            });
            child.on("exit", (code) => {
              console.log(`[OCR] Server exited (code=${code})`);
              ocrProcess = null;
            });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "started", pid: child.pid }));
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "error", message }));
          }
          return;
        }
        next();
      });
    }
  };
}
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api/ocr": {
        target: "http://127.0.0.1:8399",
        changeOrigin: true,
        rewrite: (path2) => path2.replace(/^\/api\/ocr/, "")
      }
    }
  },
  plugins: [
    react(),
    mode === "development" && ocrServerLauncher(),
    mode === "development" && componentTagger(),
    mode === "analyze" && visualizer({
      open: true,
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["robots.txt"],
      manifest: {
        name: "\u05EA\u05D5\u05E8\u05D4 \u05D5\u05DE\u05E6\u05D9\u05D0\u05D5\u05EA - \u05DE\u05E2\u05E8\u05DB\u05EA \u05DC\u05D9\u05DE\u05D5\u05D3 \u05EA\u05D5\u05E8\u05D4 \u05DE\u05EA\u05E7\u05D3\u05DE\u05EA",
        short_name: "\u05EA\u05D5\u05E8\u05D4 \u05D5\u05DE\u05E6\u05D9\u05D0\u05D5\u05EA",
        description: "\u05DE\u05E2\u05E8\u05DB\u05EA \u05DC\u05DC\u05D9\u05DE\u05D5\u05D3 \u05D2\u05DE\u05E8\u05D0 \u05D4\u05DE\u05D7\u05D1\u05E8\u05EA \u05D1\u05D9\u05DF \u05E1\u05D5\u05D2\u05D9\u05D5\u05EA \u05DC\u05E4\u05E1\u05E7\u05D9 \u05D3\u05D9\u05DF \u05D5\u05DE\u05E7\u05E8\u05D9\u05DD \u05DE\u05D5\u05D3\u05E8\u05E0\u05D9\u05D9\u05DD",
        theme_color: "#1e40af",
        background_color: "#ffffff",
        display: "standalone",
        dir: "rtl",
        lang: "he",
        start_url: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            // Cache Supabase API responses — show cached, refresh in background
            urlPattern: /^https:\/\/jaotdqumpcfhcbkgtfib\.supabase\.co\/rest\/v1\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-api-cache",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 2 }
              // 2 hours
            }
          },
          {
            // Cache Supabase Edge Functions responses
            urlPattern: /^https:\/\/jaotdqumpcfhcbkgtfib\.supabase\.co\/functions\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-functions-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 30 },
              // 30 min
              networkTimeoutSeconds: 10
            }
          },
          {
            // Cache Sefaria API
            urlPattern: /^https:\/\/www\.sefaria\.org\/api\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "sefaria-api-cache",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 }
              // 1 week
            }
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }
              // 1 year
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query": ["@tanstack/react-query"],
          "ui-core": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-accordion",
            "@radix-ui/react-popover",
            "@radix-ui/react-scroll-area"
          ],
          "icons": ["lucide-react"],
          "supabase": ["@supabase/supabase-js"],
          "recharts": ["recharts"]
        }
      }
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxqajEyMVxcXFxPbmVEcml2ZVxcXFxcdTA1RTlcdTA1RDVcdTA1RENcdTA1RDdcdTA1REYgXHUwNUQ0XHUwNUUyXHUwNUQxXHUwNUQ1XHUwNUQzXHUwNUQ0XFxcXGdlbWFyYWNhXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxqajEyMVxcXFxPbmVEcml2ZVxcXFxcdTA1RTlcdTA1RDVcdTA1RENcdTA1RDdcdTA1REYgXHUwNUQ0XHUwNUUyXHUwNUQxXHUwNUQ1XHUwNUQzXHUwNUQ0XFxcXGdlbWFyYWNhXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9qajEyMS9PbmVEcml2ZS8lRDclQTklRDclOTUlRDclOUMlRDclOTclRDclOUYlMjAlRDclOTQlRDclQTIlRDclOTElRDclOTUlRDclOTMlRDclOTQvZ2VtYXJhY2Evdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcclxuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcclxuaW1wb3J0IHsgdmlzdWFsaXplciB9IGZyb20gXCJyb2xsdXAtcGx1Z2luLXZpc3VhbGl6ZXJcIjtcclxuaW1wb3J0IHsgc3Bhd24sIHR5cGUgQ2hpbGRQcm9jZXNzIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcclxuaW1wb3J0IHR5cGUgeyBQbHVnaW4gfSBmcm9tIFwidml0ZVwiO1xyXG5cclxuLyoqXHJcbiAqIFZpdGUgcGx1Z2luIHRoYXQgbWFuYWdlcyB0aGUgT0NSIFB5dGhvbiBzZXJ2ZXIgbGlmZWN5Y2xlLlxyXG4gKiBFeHBvc2VzIFBPU1QgL2FwaS9vY3ItbGF1bmNoZXIvc3RhcnQgdG8gc3Bhd24gdGhlIHNlcnZlciBwcm9jZXNzLlxyXG4gKi9cclxuZnVuY3Rpb24gb2NyU2VydmVyTGF1bmNoZXIoKTogUGx1Z2luIHtcclxuICBsZXQgb2NyUHJvY2VzczogQ2hpbGRQcm9jZXNzIHwgbnVsbCA9IG51bGw7XHJcbiAgY29uc3QgU0NSSVBUID0gcGF0aC5yZXNvbHZlKFxyXG4gICAgcHJvY2Vzcy5lbnYuVVNFUlBST0ZJTEUgfHwgcHJvY2Vzcy5lbnYuSE9NRSB8fCBcIi5cIixcclxuICAgIFwiLnZzY29kZS9leHRlbnNpb25zL3Rlcm1pbmFsLW1vbml0b3Ivb2NyLXNlcnZlci9zZXJ2ZXIucHlcIlxyXG4gICk7XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBuYW1lOiBcIm9jci1zZXJ2ZXItbGF1bmNoZXJcIixcclxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcclxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcclxuICAgICAgICBpZiAocmVxLnVybCA9PT0gXCIvYXBpL29jci1sYXVuY2hlci9zdGFydFwiICYmIHJlcS5tZXRob2QgPT09IFwiUE9TVFwiKSB7XHJcbiAgICAgICAgICAvLyBDaGVjayBpZiBwcm9jZXNzIGlzIGFscmVhZHkgYWxpdmVcclxuICAgICAgICAgIGlmIChvY3JQcm9jZXNzICYmICFvY3JQcm9jZXNzLmtpbGxlZCkge1xyXG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMCwgeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9KTtcclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN0YXR1czogXCJhbHJlYWR5X3J1bm5pbmdcIiwgcGlkOiBvY3JQcm9jZXNzLnBpZCB9KSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBjaGlsZCA9IHNwYXduKFwicHl0aG9uXCIsIFtTQ1JJUFQsIFwiLS1wb3J0XCIsIFwiODM5OVwiXSwge1xyXG4gICAgICAgICAgICAgIHN0ZGlvOiBbXCJpZ25vcmVcIiwgXCJwaXBlXCIsIFwicGlwZVwiXSxcclxuICAgICAgICAgICAgICBkZXRhY2hlZDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgd2luZG93c0hpZGU6IHRydWUsXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgb2NyUHJvY2VzcyA9IGNoaWxkO1xyXG5cclxuICAgICAgICAgICAgY2hpbGQuc3Rkb3V0Py5vbihcImRhdGFcIiwgKGQ6IEJ1ZmZlcikgPT4ge1xyXG4gICAgICAgICAgICAgIGNvbnN0IG1zZyA9IGQudG9TdHJpbmcoKS50cmltKCk7XHJcbiAgICAgICAgICAgICAgaWYgKG1zZykgY29uc29sZS5sb2coYFtPQ1JdICR7bXNnfWApO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgY2hpbGQuc3RkZXJyPy5vbihcImRhdGFcIiwgKGQ6IEJ1ZmZlcikgPT4ge1xyXG4gICAgICAgICAgICAgIGNvbnN0IG1zZyA9IGQudG9TdHJpbmcoKS50cmltKCk7XHJcbiAgICAgICAgICAgICAgaWYgKG1zZykgY29uc29sZS5sb2coYFtPQ1JdICR7bXNnfWApO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgY2hpbGQub24oXCJleGl0XCIsIChjb2RlKSA9PiB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtPQ1JdIFNlcnZlciBleGl0ZWQgKGNvZGU9JHtjb2RlfSlgKTtcclxuICAgICAgICAgICAgICBvY3JQcm9jZXNzID0gbnVsbDtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMCwgeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9KTtcclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN0YXR1czogXCJzdGFydGVkXCIsIHBpZDogY2hpbGQucGlkIH0pKTtcclxuICAgICAgICAgIH0gY2F0Y2ggKGVycjogdW5rbm93bikge1xyXG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpO1xyXG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDUwMCwgeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9KTtcclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlIH0pKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgbmV4dCgpO1xyXG4gICAgICB9KTtcclxuICAgIH0sXHJcbiAgfTtcclxufVxyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcclxuICBzZXJ2ZXI6IHtcclxuICAgIGhvc3Q6IFwiOjpcIixcclxuICAgIHBvcnQ6IDgwODAsXHJcbiAgICBwcm94eToge1xyXG4gICAgICBcIi9hcGkvb2NyXCI6IHtcclxuICAgICAgICB0YXJnZXQ6IFwiaHR0cDovLzEyNy4wLjAuMTo4Mzk5XCIsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGlcXC9vY3IvLCBcIlwiKSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgbW9kZSA9PT0gXCJkZXZlbG9wbWVudFwiICYmIG9jclNlcnZlckxhdW5jaGVyKCksXHJcbiAgICBtb2RlID09PSBcImRldmVsb3BtZW50XCIgJiYgY29tcG9uZW50VGFnZ2VyKCksXHJcbiAgICBtb2RlID09PSBcImFuYWx5emVcIiAmJiB2aXN1YWxpemVyKHtcclxuICAgICAgb3BlbjogdHJ1ZSxcclxuICAgICAgZmlsZW5hbWU6ICdkaXN0L3N0YXRzLmh0bWwnLFxyXG4gICAgICBnemlwU2l6ZTogdHJ1ZSxcclxuICAgICAgYnJvdGxpU2l6ZTogdHJ1ZSxcclxuICAgIH0pLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxyXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ3JvYm90cy50eHQnXSxcclxuICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICBuYW1lOiAnXHUwNUVBXHUwNUQ1XHUwNUU4XHUwNUQ0IFx1MDVENVx1MDVERVx1MDVFNlx1MDVEOVx1MDVEMFx1MDVENVx1MDVFQSAtIFx1MDVERVx1MDVFMlx1MDVFOFx1MDVEQlx1MDVFQSBcdTA1RENcdTA1RDlcdTA1REVcdTA1RDVcdTA1RDMgXHUwNUVBXHUwNUQ1XHUwNUU4XHUwNUQ0IFx1MDVERVx1MDVFQVx1MDVFN1x1MDVEM1x1MDVERVx1MDVFQScsXHJcbiAgICAgICAgc2hvcnRfbmFtZTogJ1x1MDVFQVx1MDVENVx1MDVFOFx1MDVENCBcdTA1RDVcdTA1REVcdTA1RTZcdTA1RDlcdTA1RDBcdTA1RDVcdTA1RUEnLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnXHUwNURFXHUwNUUyXHUwNUU4XHUwNURCXHUwNUVBIFx1MDVEQ1x1MDVEQ1x1MDVEOVx1MDVERVx1MDVENVx1MDVEMyBcdTA1RDJcdTA1REVcdTA1RThcdTA1RDAgXHUwNUQ0XHUwNURFXHUwNUQ3XHUwNUQxXHUwNUU4XHUwNUVBIFx1MDVEMVx1MDVEOVx1MDVERiBcdTA1RTFcdTA1RDVcdTA1RDJcdTA1RDlcdTA1RDVcdTA1RUEgXHUwNURDXHUwNUU0XHUwNUUxXHUwNUU3XHUwNUQ5IFx1MDVEM1x1MDVEOVx1MDVERiBcdTA1RDVcdTA1REVcdTA1RTdcdTA1RThcdTA1RDlcdTA1REQgXHUwNURFXHUwNUQ1XHUwNUQzXHUwNUU4XHUwNUUwXHUwNUQ5XHUwNUQ5XHUwNUREJyxcclxuICAgICAgICB0aGVtZV9jb2xvcjogJyMxZTQwYWYnLFxyXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjZmZmZmZmJyxcclxuICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXHJcbiAgICAgICAgZGlyOiAncnRsJyxcclxuICAgICAgICBsYW5nOiAnaGUnLFxyXG4gICAgICAgIHN0YXJ0X3VybDogJy8nLFxyXG4gICAgICAgIGljb25zOiBbXHJcbiAgICAgICAgICB7IHNyYzogJy9wd2EtMTkyeDE5Mi5wbmcnLCBzaXplczogJzE5MngxOTInLCB0eXBlOiAnaW1hZ2UvcG5nJyB9LFxyXG4gICAgICAgICAgeyBzcmM6ICcvcHdhLTUxMng1MTIucG5nJywgc2l6ZXM6ICc1MTJ4NTEyJywgdHlwZTogJ2ltYWdlL3BuZycgfSxcclxuICAgICAgICAgIHsgc3JjOiAnL3B3YS01MTJ4NTEyLnBuZycsIHNpemVzOiAnNTEyeDUxMicsIHR5cGU6ICdpbWFnZS9wbmcnLCBwdXJwb3NlOiAnYW55IG1hc2thYmxlJyB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHdvcmtib3g6IHtcclxuICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZjJ9J10sXHJcbiAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgLy8gQ2FjaGUgU3VwYWJhc2UgQVBJIHJlc3BvbnNlcyBcdTIwMTQgc2hvdyBjYWNoZWQsIHJlZnJlc2ggaW4gYmFja2dyb3VuZFxyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2phb3RkcXVtcGNmaGNia2d0ZmliXFwuc3VwYWJhc2VcXC5jb1xcL3Jlc3RcXC92MVxcLy4qL2ksXHJcbiAgICAgICAgICAgIGhhbmRsZXI6ICdTdGFsZVdoaWxlUmV2YWxpZGF0ZScsXHJcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdzdXBhYmFzZS1hcGktY2FjaGUnLFxyXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHsgbWF4RW50cmllczogMzAwLCBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMiB9LCAvLyAyIGhvdXJzXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICAvLyBDYWNoZSBTdXBhYmFzZSBFZGdlIEZ1bmN0aW9ucyByZXNwb25zZXNcclxuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9qYW90ZHF1bXBjZmhjYmtndGZpYlxcLnN1cGFiYXNlXFwuY29cXC9mdW5jdGlvbnNcXC92MVxcLy4qL2ksXHJcbiAgICAgICAgICAgIGhhbmRsZXI6ICdOZXR3b3JrRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnc3VwYWJhc2UtZnVuY3Rpb25zLWNhY2hlJyxcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDUwLCBtYXhBZ2VTZWNvbmRzOiA2MCAqIDMwIH0sIC8vIDMwIG1pblxyXG4gICAgICAgICAgICAgIG5ldHdvcmtUaW1lb3V0U2Vjb25kczogMTAsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICAvLyBDYWNoZSBTZWZhcmlhIEFQSVxyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL3d3d1xcLnNlZmFyaWFcXC5vcmdcXC9hcGlcXC8uKi9pLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsXHJcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdzZWZhcmlhLWFwaS1jYWNoZScsXHJcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjogeyBtYXhFbnRyaWVzOiA1MDAsIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDcgfSwgLy8gMSB3ZWVrXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICAvLyBDYWNoZSBHb29nbGUgRm9udHNcclxuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLihnb29nbGVhcGlzfGdzdGF0aWMpXFwuY29tXFwvLiovaSxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnZ29vZ2xlLWZvbnRzLWNhY2hlJyxcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDMwLCBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjUgfSwgLy8gMSB5ZWFyXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICB9KSxcclxuICBdLmZpbHRlcihCb29sZWFuKSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgdGFyZ2V0OiAnZXMyMDIwJyxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAncmVhY3QtdmVuZG9yJzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxyXG4gICAgICAgICAgJ3F1ZXJ5JzogWydAdGFuc3RhY2svcmVhY3QtcXVlcnknXSxcclxuICAgICAgICAgICd1aS1jb3JlJzogW1xyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWRpYWxvZycsXHJcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudScsXHJcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtdGFicycsXHJcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtdG9vbHRpcCcsXHJcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtYWNjb3JkaW9uJyxcclxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1wb3BvdmVyJyxcclxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1zY3JvbGwtYXJlYScsXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgICAgJ2ljb25zJzogWydsdWNpZGUtcmVhY3QnXSxcclxuICAgICAgICAgICdzdXBhYmFzZSc6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJ10sXHJcbiAgICAgICAgICAncmVjaGFydHMnOiBbJ3JlY2hhcnRzJ10sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxufSkpO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQThYLFNBQVMsb0JBQW9CO0FBQzNaLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsYUFBZ0M7QUFOekMsSUFBTSxtQ0FBbUM7QUFhekMsU0FBUyxvQkFBNEI7QUFD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
