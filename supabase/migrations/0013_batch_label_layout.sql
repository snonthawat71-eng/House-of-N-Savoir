-- =====================================================================
-- HOUSE OF N SAVOIR — ปรับ Batch Label ตามแบบสติกเกอร์จริง
-- 1) QUANTITY เปลี่ยนเป็นข้อความ เพราะต้องใส่แบบ "4 x 5.0 KG."
-- 2) กำหนดขนาดสติกเกอร์เองได้ (ค่าเริ่มต้น = 80 x 50 mm ที่แนะนำ)
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

-- QUANTITY: ตัวเลข -> ข้อความ (ของเดิมที่มีอยู่แปลงเป็นข้อความให้อัตโนมัติ)
alter table public.batch_labels drop constraint if exists batch_labels_quantity_check;
alter table public.batch_labels
  alter column quantity type text using quantity::text;

-- ขนาดสติกเกอร์ต่อใบ (มิลลิเมตร)
alter table public.batch_labels
  add column if not exists width_mm  numeric not null default 80,
  add column if not exists height_mm numeric not null default 50;
