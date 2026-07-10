import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// PWA = ทำให้ติดตั้งลงหน้าจอโฮมมือถือได้ และเปิดใช้ push ได้ในอนาคต
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "HOUSE OF N SAVOIR",
        short_name: "N SAVOIR",
        description: "ระบบภายในบริษัท House of N Savoir",
        theme_color: "#111214",
        background_color: "#F1F2F4",
        display: "standalone",
        orientation: "portrait",
        lang: "th",
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
    }),
  ],
});
