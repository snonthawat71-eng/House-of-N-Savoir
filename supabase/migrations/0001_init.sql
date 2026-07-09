-- =====================================================================
-- HOUSE OF N SAVOIR — เฟส 0: ตารางพื้นฐาน + ความปลอดภัย (RLS)
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

-- ---------- 1) ตารางอีเมลที่ได้รับเชิญ (ใครเข้าได้ + role อะไร) ----------
-- เข้าได้เฉพาะอีเมลในตารางนี้เท่านั้น (invite-only)
create table if not exists public.allowed_emails (
  email      text primary key,
  role       text not null default 'sales'
             check (role in ('owner','dev','manager','sales')),
  full_name  text,
  active      boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 2) ตารางโปรไฟล์ผู้ใช้ (ผูกกับบัญชีล็อกอิน) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text unique not null,
  full_name  text,
  role       text not null default 'sales'
             check (role in ('owner','dev','manager','sales')),
  active      boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 3) ตารางบันทึกการใช้งาน (Audit Log) ----------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  actor_email text,
  action      text not null,            -- view / create / update / delete / login
  entity      text,                     -- ทำกับข้อมูลอะไร เช่น product, quote
  entity_id   text,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- ---------- 4) ฟังก์ชันช่วยเช็ค role (ใช้ใน RLS) ----------
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('owner','dev') from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------- 5) auto-provision: สร้างโปรไฟล์อัตโนมัติเมื่อล็อกอินครั้งแรก ----------
-- ถ้าอีเมลไม่อยู่ในรายการเชิญ (allowed_emails) → บล็อก ไม่ให้เข้า
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed public.allowed_emails%rowtype;
begin
  select * into allowed
  from public.allowed_emails
  where lower(email) = lower(new.email) and active = true;

  if not found then
    raise exception 'email % is not invited', new.email;
  end if;

  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    new.email,
    coalesce(allowed.full_name, new.raw_user_meta_data ->> 'full_name'),
    allowed.role,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 6) เปิด Row Level Security + กติกาการเข้าถึง ----------
alter table public.profiles       enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.audit_log      enable row level security;

-- profiles: เห็นของตัวเอง / owner+dev เห็นทั้งหมด
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select using (public.is_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- allowed_emails: เฉพาะ owner+dev จัดการได้
drop policy if exists allowed_admin_all on public.allowed_emails;
create policy allowed_admin_all on public.allowed_emails
  for all using (public.is_admin()) with check (public.is_admin());

-- audit_log: ทุกคนที่ล็อกอินเขียนบันทึกของตัวเองได้ / เฉพาะ owner+dev อ่านได้
drop policy if exists audit_insert_self on public.audit_log;
create policy audit_insert_self on public.audit_log
  for insert with check (actor_id = auth.uid());

drop policy if exists audit_select_admin on public.audit_log;
create policy audit_select_admin on public.audit_log
  for select using (public.is_admin());

-- ---------- 7) สิทธิ์เรียกใช้ฟังก์ชัน ----------
grant execute on function public.my_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- =====================================================================
-- 8) เชิญผู้ใช้คนแรก (เจ้าของ) — แก้อีเมลให้ตรงก่อน Run ถ้าจำเป็น
-- =====================================================================
insert into public.allowed_emails (email, role, full_name)
values ('nonthawat.code@gmail.com', 'owner', 'เจ้าของ')
on conflict (email) do update set role = excluded.role, active = true;

-- ตัวอย่างเชิญคนอื่นเพิ่ม (ลบเครื่องหมาย -- ออกแล้วแก้อีเมล):
-- insert into public.allowed_emails (email, role, full_name)
-- values ('manager@example.com', 'manager', 'ผู้จัดการ')
-- on conflict (email) do update set role = excluded.role, active = true;
