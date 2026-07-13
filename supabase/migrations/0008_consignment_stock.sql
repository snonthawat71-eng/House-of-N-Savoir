-- =====================================================================
-- HOUSE OF N SAVOIR — B2C ฝากขาย (Consignment) : ส่งสต็อก / ตัด / คืน
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

-- 1) รหัสสินค้าเฉพาะร้าน (แต่ละร้านใช้รหัสไม่เหมือนกัน) เก็บที่สต็อกต่อร้าน
alter table public.stock_items
  add column if not exists shop_code text;

-- 2) ประวัติ "ส่งสต็อก" เข้าร้านฝากขาย
create table if not exists public.consignment_shipments (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid references public.stock_locations (id) on delete cascade,
  product_id  uuid references public.products (id) on delete set null,
  shop_code   text,
  qty         integer not null default 0,
  sender      text,
  sent_at     timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists consignment_shipments_loc_idx
  on public.consignment_shipments (location_id, sent_at desc);

-- 3) ประวัติ "ตัดสต็อก / คืนสินค้า"
create table if not exists public.consignment_movements (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid references public.stock_locations (id) on delete cascade,
  product_id  uuid references public.products (id) on delete set null,
  kind        text not null check (kind in ('cut','return')),
  qty         integer not null default 0,
  moved_at    date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists consignment_movements_loc_idx
  on public.consignment_movements (location_id, moved_at desc);

-- 4) สิทธิ์ (เฉพาะผู้ใช้ที่ active — เหมือนตารางอื่น)
alter table public.consignment_shipments enable row level security;
alter table public.consignment_movements enable row level security;

drop policy if exists consignment_shipments_team on public.consignment_shipments;
create policy consignment_shipments_team on public.consignment_shipments
  for all using (public.is_active_user()) with check (public.is_active_user());

drop policy if exists consignment_movements_team on public.consignment_movements;
create policy consignment_movements_team on public.consignment_movements
  for all using (public.is_active_user()) with check (public.is_active_user());
