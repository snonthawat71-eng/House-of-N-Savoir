-- =====================================================================
-- HOUSE OF N SAVOIR — เปลี่ยนขนาดสติกเกอร์ FO Label ที่แนะนำ
-- จาก 152.4 x 101.6 mm  →  210 x 145 mm (ลงกระดาษ A4 ได้แผ่นละ 2 ดวง)
--
-- ไฟล์นี้แก้แค่ "ค่าตั้งต้น" ของรายการใหม่เท่านั้น
-- รายการเดิมที่เคยบันทึกไว้ ขนาดยังเป็นค่าเดิม ไม่ถูกแตะ
-- (ถ้าอยากเปลี่ยนของเดิมด้วย ให้เอาเครื่องหมาย -- หน้า 2 บรรทัดสุดท้ายออก)
--
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- รันซ้ำได้ ไม่พัง
-- =====================================================================

alter table if exists public.fo_labels alter column width_mm  set default 210;
alter table if exists public.fo_labels alter column height_mm set default 145;

-- เปลี่ยนขนาดของรายการเดิมทั้งหมดด้วย (ถ้าต้องการ):
-- update public.fo_labels set width_mm = 210, height_mm = 145
--   where width_mm = 152.4 and height_mm = 101.6;
