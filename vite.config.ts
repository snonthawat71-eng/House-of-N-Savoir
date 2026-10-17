import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// เวอร์ชันแอป = เวลาที่ build (ปี.เดือน.วัน-ชั่วโมงนาที) ใช้โชว์ในหน้า Manage
const now = new Date();
const p = (n: number) => String(n).padStart(2, "0");
const APP_VERSION = `${now.getFullYear()}.${p(now.getMonth() + 1)}.${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;

// PWA = ทำให้ติดตั้งลงหน้าจอโฮมมือถือได้ และเปิดใช้ push ได้ในอนาคต
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_TIME__: JSON.stringify(now.toISOString()),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // jsPDF เรียก 3 ตัวนี้เฉพาะตอนแปลง HTML เป็น PDF ซึ่งเราไม่ได้ใช้
      // ชี้ไปโมดูลเปล่าเพื่อไม่ให้ติดมาในไฟล์แอป (ประหยัดไปราว 350KB)
      html2canvas: fileURLToPath(new URL("./src/lib/empty-stub.ts", import.meta.url)),
      dompurify: fileURLToPath(new URL("./src/lib/empty-stub.ts", import.meta.url)),
      canvg: fileURLToPath(new URL("./src/lib/empty-stub.ts", import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      workbox: {
        // ไฟล์ก้อนใหญ่ที่ใช้เป็นครั้งคราว (หน้า Print, ตัวอ่าน Excel)
        // ไม่ต้องโหลดล่วงหน้าตอนติดตั้งแอป — ค่อยโหลดตอนเปิดใช้จริงแล้วเก็บไว้เอง
        globIgnores: ["**/Print-*.js", "**/xlsx-*.js", "**/labelPdf-*.js"],
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
