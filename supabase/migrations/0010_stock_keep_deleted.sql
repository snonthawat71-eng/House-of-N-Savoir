-- =====================================================================
-- HOUSE OF N SAVOIR — sync Product List กับสต็อกร้าน:
-- ลบสินค้าออกจาก Product List แล้ว "รายการในร้านยังอยู่" แต่ขึ้นว่าไม่มีสินค้า
-- (เดิมลบสินค้า = รายการสต็อกร้านหายเงียบ เพราะ on delete cascade)
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

alter table public.stock_items alter column product_id drop not null;

alter table public.stock_items drop constraint if exists stock_items_product_id_fkey;
alter table public.stock_items add constraint stock_items_product_id_fkey
  foreign key (product_id) references public.products (id) on delete set null;
