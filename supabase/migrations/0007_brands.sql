-- =====================================================================
-- HOUSE OF N SAVOIR — B2C Product List: แบรนด์ + รูปสินค้า/ขนาด
-- (เปลี่ยนหน้า "Product Stock" เป็น "Product List" แคตตาล็อกตามแบรนด์)
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

-- ---------- 1) ตารางแบรนด์ (มีแค่รูป + ชื่อ) ----------
create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  logo_url   text,
  created_at timestamptz not null default now()
);

alter table public.brands enable row level security;
drop policy if exists brands_team on public.brands;
create policy brands_team on public.brands
  for all using (public.is_active_user()) with check (public.is_active_user());

-- ---------- 2) เพิ่มฟิลด์รูป/ขนาด/แบรนด์ ในตารางสินค้ากลาง ----------
alter table public.products
  add column if not exists brand_id  uuid references public.brands (id) on delete set null,
  add column if not exists image_url text,
  add column if not exists size      text;

-- ---------- 3) สร้างมุมมองสินค้าใหม่ (ปิดต้นทุนให้คนไม่มีสิทธิ์เหมือนเดิม + เพิ่มฟิลด์ใหม่) ----------
drop view if exists public.products_view;
create view public.products_view as
  select
    id, sku, name, type, retail, stock, created_at, updated_at,
    brand_id, image_url, size,
    case when public.is_cost_visible() then cost else null end as cost
  from public.products;

grant select on public.products_view to authenticated;
