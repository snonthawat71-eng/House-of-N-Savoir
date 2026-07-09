import { createClient } from "@supabase/supabase-js";

// อ่านค่าลับจากไฟล์ .env (ห้ามใส่คีย์ลงในโค้ดตรง ๆ)
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// ถ้ายังไม่ได้ตั้งค่า .env จะเป็น false → แอปจะรันโหมดเดโม (ข้อมูลจำลอง)
export const isSupabaseConfigured = Boolean(url && anon);

export const supabase = isSupabaseConfigured
  ? createClient(url!, anon!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : (null as unknown as ReturnType<typeof createClient>);
