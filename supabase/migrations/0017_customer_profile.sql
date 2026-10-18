-- =====================================================================
-- HOUSE OF N SAVOIR — เพิ่มข้อมูลลูกค้าให้ครบเหมือนร้านฝากขาย
-- เพิ่ม 3 ช่อง: โลโก้/รูปลูกค้า · ที่อยู่ · เลขผู้เสียภาษี
-- (ช่อง อีเมล / เบอร์โทร มีอยู่แล้ว)
--
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- รันซ้ำได้ ไม่พัง ข้อมูลเดิมไม่หาย
-- =====================================================================

alter table public.customers
  add column if not exists logo_url text,
  add column if not exists address  text,
  add column if not exists tax_id   text;
