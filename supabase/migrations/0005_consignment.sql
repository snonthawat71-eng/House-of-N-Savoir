-- =====================================================================
-- HOUSE OF N SAVOIR — B2C Consignment: ข้อมูลร้านฝากขาย + บันทึกการขาย
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

-- ---------- 1) เพิ่มข้อมูลร้านในตารางช่องทาง/สาขา ----------
alter table public.stock_locations
  add column if not exists shop_name   text,
  add column if not exists branch_code text,
  add column if not exists branch_name text,
  add column if not exists address     text,
  add column if not exists tax_id      text,
  add column if not exists phone       text,
  add column if not exists email       text,
  add column if not exists logo_url    text,
  add column if not exists updated_at  timestamptz not null default now();

-- ---------- 2) ตารางบันทึกการขายฝากขาย (ไว้คิดยอดขายรายเดือน/รวม) ----------
create table if not exists public.consignment_sales (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid references public.stock_locations (id) on delete cascade,
  product_id  uuid references public.products (id) on delete set null,
  product_name text,
  qty         integer not null default 1,
  amount      numeric not null default 0,
  sold_at     date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists consignment_sales_loc_idx on public.consignment_sales (location_id, sold_at desc);

alter table public.consignment_sales enable row level security;
drop policy if exists consignment_sales_team on public.consignment_sales;
create policy consignment_sales_team on public.consignment_sales
  for all using (public.is_active_user()) with check (public.is_active_user());
