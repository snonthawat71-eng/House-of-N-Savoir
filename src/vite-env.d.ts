/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_CONNECT_PIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** ค่าที่ใส่ให้ตอน build (ดู define ใน vite.config.ts) */
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
