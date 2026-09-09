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
      },
      // Let the SW work in `vite preview` / dev testing too.
      devOptions: { enabled: false },
    }),
  ],
  server: { host: true, port: 5173 },
});
