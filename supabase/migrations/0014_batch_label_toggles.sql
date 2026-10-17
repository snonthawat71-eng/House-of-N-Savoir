-- =====================================================================
-- HOUSE OF N SAVOIR — Batch Label: เลือกได้ว่าจะใส่ Data Matrix / โลโก้ ไหม
-- ปิดทั้งคู่ = ตัวหนังสือได้พื้นที่เต็มใบ (เหมือนสติกเกอร์ที่ใช้อยู่จริง)
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

alter table public.batch_labels
  add column if not exists show_dm   boolean not null default true,
  add column if not exists show_logo boolean not null default true;
