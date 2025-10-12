/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const authHeaderCachePlugin = {
  cacheWillUpdate: async ({ request, response }: { request: Request; response?: Response | null }) => {
    if (request.headers.has("Authorization")) {
      return null;
    }
    if (!response) {
      return null;
    }
    if (response.status === 401 || response.status === 403) {
      return null;
    }
    return response;
  },
};

export default defineConfig({
  server: {
    host: true,
  },
  resolve: {
    alias: {
      components: path.resolve(__dirname, "src/components"),
      hooks: path.resolve(__dirname, "src/hooks"),
      utils: path.resolve(__dirname, "src/utils"),
      styles: path.resolve(__dirname, "src/styles"),
      pages: path.resolve(__dirname, "src/pages"),
      store: path.resolve(__dirname, "src/store"),
      config: path.resolve(__dirname, "src/config"),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "icono.png"],
      manifest: {
        name: "Pollos Tello's",
        short_name: "Pollos Tello's",
        start_url: "/",
        display: "standalone",
        background_color: "#f8efe7",
        theme_color: "#c8102e",
        description: "Alta gastronomía sin espera.",
        icons: [
          {
            src: "/icons-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/pollos-tellos-api\.onrender\.com\/.*$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200],
              },
              plugins: [authHeaderCachePlugin],
            },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
  },
});
