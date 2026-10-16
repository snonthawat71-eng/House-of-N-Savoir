-- =====================================================================
-- HOUSE OF N SAVOIR — อุดรูรั่ว products_view
-- ปัญหา: มุมมองนี้ใช้สิทธิ์ของคนสร้าง (security definer) จึงข้ามด่าน RLS
--        ของตาราง products — คนที่ล็อกอิน Google ได้แต่ไม่ได้รับเชิญ
--        หรือคนที่ถูกปิดบัญชี ยังดึงรายชื่อสินค้า/ราคาขาย/สต็อกออกไปได้
-- แก้: ใส่ด่าน is_active_user() ไว้ในมุมมองเอง
--
-- หมายเหตุ: ห้ามเปลี่ยนเป็น security_invoker = on เด็ดขาด เพราะตาราง
--           products เปิดอ่านเฉพาะ owner/dev/manager (กันต้นทุนรั่ว)
--           ถ้าเปลี่ยน ฝ่ายขาย/ฝ่ายจัดซื้อจะมองไม่เห็นสินค้าเลยสักชิ้น
--
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

create or replace view public.products_view as
  select
    id, sku, name, type, retail, stock, created_at, updated_at,
    brand_id, image_url, size,
    case when public.is_cost_visible() then cost else null end as cost
  from public.products
  where public.is_active_user();

grant select on public.products_view to authenticated;
