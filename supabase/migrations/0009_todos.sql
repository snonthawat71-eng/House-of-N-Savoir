-- =====================================================================
-- HOUSE OF N SAVOIR — Note / To-do รายวัน + มอบหมายให้กันในทีม
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

-- 1) ตารางงาน/โน้ต
create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  detail      text,
  due_date    date not null default current_date,
  due_time    time,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists todos_due_idx on public.todos (due_date, due_time);
create index if not exists todos_assigned_idx on public.todos (assigned_to, done, due_date);

-- 2) สิทธิ์: ทีม (ผู้ใช้ active) เห็น/จัดการได้ — ใช้แบบเดียวกับตารางงานอื่น
alter table public.todos enable row level security;
drop policy if exists todos_team on public.todos;
create policy todos_team on public.todos
  for all using (public.is_active_user()) with check (public.is_active_user());

-- 3) ให้สมาชิกทีมเห็นชื่อกันและกัน (ไว้เลือกคนมอบหมาย)
--    เดิม profiles อ่านได้เฉพาะของตัวเอง/แอดมิน — เพิ่ม policy อ่านอย่างเดียวสำหรับทีม
drop policy if exists profiles_select_team on public.profiles;
create policy profiles_select_team on public.profiles
  for select using (public.is_active_user());
