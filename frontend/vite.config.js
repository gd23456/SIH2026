import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// The PWA service worker precaches the app shell so Karigar opens with no
// network after one visit — the "installs without the Play Store, runs offline"
// story. manifest:false keeps the hand-written public/manifest.webmanifest
// (already linked in index.html) as the single source of truth.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false,
      workbox: {
        // Cache the built shell + the local icon/manifest. API calls are NOT
        // precached — those go to the laptop and fall back to demo data.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,woff2}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        // Generated 3D models: immutable per job id (the server says so), so
        // once viewed they open again with no network — and never re-download
        // a multi-MB file on a metered connection.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/api\/models\/[0-9a-f]{32}\/model\.glb$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "karigar-models",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Let the SW work in `vite preview` / dev testing too.
      devOptions: { enabled: false },
    }),
  ],
  server: { host: true, port: 5173 },
});
