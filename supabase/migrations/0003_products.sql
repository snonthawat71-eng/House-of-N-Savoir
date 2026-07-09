-- =====================================================================
-- HOUSE OF N SAVOIR — เฟส 1: Product Master (คลังสินค้ากลาง)
-- + เอาอีเมล s.nonthawat71@gmail.com ออกจากโปรเจกต์
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

-- ---------- 0) เอาอีเมลที่ไม่เกี่ยวข้องออก ----------
delete from public.profiles       where lower(email) = 's.nonthawat71@gmail.com';
delete from public.allowed_emails where lower(email) = 's.nonthawat71@gmail.com';

-- ยืนยันเจ้าของคือ nonthawat.code@gmail.com
insert into public.allowed_emails (email, role, full_name)
values ('nonthawat.code@gmail.com', 'owner', 'เจ้าของ')
on conflict (email) do update set role = 'owner', active = true;

-- ---------- 1) ตารางสินค้ากลาง ----------
create table if not exists public.products (
  id         uuid primary key default gen_random_uuid(),
  sku        text unique not null,
  name       text not null,
  type       text,
  cost       numeric,           -- ต้นทุน (ความลับ)
  retail     numeric,           -- ราคาขาย
  stock      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 2) ใครเห็นต้นทุนได้บ้าง (owner/dev/manager) ----------
create or replace function public.is_cost_visible()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role in ('owner','dev','manager') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.can_edit_products()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role in ('owner','dev','manager') from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_cost_visible() to authenticated;
grant execute on function public.can_edit_products() to authenticated;

-- ---------- 3) RLS ตารางสินค้า ----------
-- อ่านตารางหลัก (มีต้นทุน) ได้เฉพาะคนที่เห็นต้นทุน / แก้ได้เฉพาะคนที่มีสิทธิ์
alter table public.products enable row level security;

drop policy if exists products_select_cost on public.products;
create policy products_select_cost on public.products
  for select using (public.is_cost_visible());

drop policy if exists products_write on public.products;
create policy products_write on public.products
  for all using (public.can_edit_products()) with check (public.can_edit_products());

-- ---------- 4) มุมมองที่ "ปิดต้นทุน" ให้คนไม่มีสิทธิ์ (ที่ระดับฐานข้อมูลจริง) ----------
-- ทุกคนที่ล็อกอินอ่านมุมมองนี้ได้ แต่ถ้าไม่มีสิทธิ์เห็นต้นทุน ช่อง cost จะเป็น null เสมอ
create or replace view public.products_view as
  select
    id, sku, name, type, retail, stock, created_at, updated_at,
    case when public.is_cost_visible() then cost else null end as cost
  from public.products;

grant select on public.products_view to authenticated;

-- ---------- 5) ใส่สินค้าตัวอย่างเริ่มต้น ----------
insert into public.products (sku, name, type, cost, retail, stock) values
  ('NS-EDP-001', 'Nuit de Vétiver', 'Eau de Parfum 50ml', 420, 2900, 38),
  ('NS-CDL-014', 'Fleur de Sel',    'Scented Candle 220g', 190, 1250, 12),
  ('NS-DFF-006', 'Bois d''Encre',   'Reed Diffuser 200ml', 260, 1650, 5),
  ('NS-EDP-022', 'Rose Absinthe',   'Eau de Parfum 50ml', 460, 3200, 27)
on conflict (sku) do nothing;
