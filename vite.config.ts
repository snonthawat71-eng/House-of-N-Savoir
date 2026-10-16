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
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      workbox: {
        // ไฟล์ก้อนใหญ่ที่ใช้เป็นครั้งคราว (หน้า Print, ตัวอ่าน Excel)
        // ไม่ต้องโหลดล่วงหน้าตอนติดตั้งแอป — ค่อยโหลดตอนเปิดใช้จริงแล้วเก็บไว้เอง
        globIgnores: ["**/Print-*.js", "**/xlsx-*.js"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
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
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
