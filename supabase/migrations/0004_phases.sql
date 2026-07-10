-- =====================================================================
-- HOUSE OF N SAVOIR — เฟส 2-6: B2B / B2C / Supplier / Office / Formula Lab
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

-- ---------- ฟังก์ชันช่วยเช็คสิทธิ์ ----------
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select active from public.profiles where id = auth.uid()), false); $$;

create or replace function public.is_manager_up()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select active and role in ('owner','dev','manager') from public.profiles where id = auth.uid()), false); $$;

grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_manager_up() to authenticated;

-- ---------- ลูกค้า (ฐานกลาง ใช้ทั้ง B2B/B2C) ----------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'b2b' check (kind in ('b2b','b2c')),
  contact text, phone text, email text,
  credit_terms text,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- ออเดอร์ ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text,
  kind text not null default 'b2b' check (kind in ('b2b','b2c')),
  status text not null default 'pending'
    check (status in ('pending','shipped','paid','done','returned','claim','cancelled')),
  items jsonb not null default '[]',
  total numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- ใบเสนอราคา ----------
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  customer_name text not null,
  items jsonb not null default '[]',
  total numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','accepted','expired')),
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ---------- ตัวอย่างสินค้าที่ส่ง (tracking) ----------
create table if not exists public.samples (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  item text not null,
  sent_date date default current_date,
  tracking text,
  status text not null default 'รอผล' check (status in ('รอผล','ตอบรับแล้ว','ปฏิเสธ')),
  created_at timestamptz not null default now()
);

-- ---------- สต็อกหลายช่องทาง (B2C) ----------
create table if not exists public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'store' check (kind in ('store','warehouse','online','consign')),
  created_at timestamptz not null default now()
);
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.stock_locations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  qty integer not null default 0,
  sold integer not null default 0,      -- ใช้กับฝากขาย
  returned integer not null default 0,  -- ใช้กับฝากขาย
  unique (location_id, product_id)
);

-- ---------- การตลาด (แคมเปญ) ----------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text,
  status text not null default 'active' check (status in ('active','paused','done')),
  note text,
  created_at timestamptz not null default now()
);

-- ---------- Supplier / วัตถุดิบ / PO / สัญญา ----------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  material text,
  contact text, phone text, email text,
  contract_end date,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  supplier_name text,
  items jsonb not null default '[]',
  total numeric not null default 0,
  status text not null default 'open' check (status in ('open','sent','received','cancelled')),
  note text,
  created_at timestamptz not null default now()
);

-- ---------- Formula Lab (ลับสุดยอด — owner/dev เท่านั้น) ----------
create table if not exists public.formulas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product_sku text,
  lines jsonb not null default '[]',        -- [{ingredient, pct}]
  cost_material numeric default 0,
  cost_packaging numeric default 0,
  multiplier numeric default 4.8,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- เปิด RLS ----------
alter table public.customers        enable row level security;
alter table public.orders           enable row level security;
alter table public.quotations      enable row level security;
alter table public.samples          enable row level security;
alter table public.stock_locations  enable row level security;
alter table public.stock_items      enable row level security;
alter table public.campaigns        enable row level security;
alter table public.suppliers        enable row level security;
alter table public.purchase_orders  enable row level security;
alter table public.formulas         enable row level security;

-- ทีมทุกคน (ที่ถูกเชิญ+ยังใช้งาน) ใช้ B2B/B2C ได้
do $$ declare t text;
begin
  foreach t in array array['customers','orders','quotations','samples','stock_locations','stock_items','campaigns'] loop
    execute format('drop policy if exists %I_team on public.%I', t, t);
    execute format('create policy %I_team on public.%I for all using (public.is_active_user()) with check (public.is_active_user())', t, t);
  end loop;
end $$;

-- Supplier: เฉพาะ owner/dev/manager
drop policy if exists suppliers_mgr on public.suppliers;
create policy suppliers_mgr on public.suppliers
  for all using (public.is_manager_up()) with check (public.is_manager_up());
drop policy if exists po_mgr on public.purchase_orders;
create policy po_mgr on public.purchase_orders
  for all using (public.is_manager_up()) with check (public.is_manager_up());

-- Formula: เฉพาะ owner/dev
drop policy if exists formulas_admin on public.formulas;
create policy formulas_admin on public.formulas
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- ช่องทางสต็อกเริ่มต้น ----------
insert into public.stock_locations (name, kind)
select v.name, v.kind from (values
  ('หน้าร้าน', 'store'),
  ('คลังกลาง', 'warehouse'),
  ('ออนไลน์', 'online'),
  ('ฝากขาย', 'consign')
) as v(name, kind)
where not exists (select 1 from public.stock_locations);
