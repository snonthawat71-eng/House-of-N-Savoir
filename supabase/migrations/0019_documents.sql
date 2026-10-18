-- =====================================================================
-- HOUSE OF N SAVOIR — คลังเอกสาร (Document)
-- เก็บไฟล์ที่เดียว แสดง 2 ที่: หน้า Office (ทั้งหมด) และหน้าลูกค้า B2B (เฉพาะของเขา)
--
-- customer_id = null  → เอกสารกลางของบริษัท (ใช้ร่วมทุกราย)
-- customer_id = ลูกค้า → เอกสารของแบรนด์ลูกค้ารายนั้น
--
-- ไฟล์เก็บใน bucket "docs" แบบ "ปิด" — ต้องล็อกอินถึงเปิดได้
-- หน้าเว็บจะขอลิงก์ชั่วคราว (หมดอายุใน 1 ชั่วโมง) ทุกครั้งที่กดเปิด/ดาวน์โหลด
--
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- รันซ้ำได้ ไม่พัง
-- =====================================================================

-- ---------- 1) ตารางเอกสาร ----------
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete cascade,
  category    text not null default 'other'
              check (category in ('logo','presentation','marketing','packaging','other')),
  title       text not null,
  file_path   text not null,          -- ที่อยู่ไฟล์ใน bucket "docs" (ไม่ใช่ลิงก์สาธารณะ)
  file_name   text,
  file_type   text,
  file_size   bigint,
  note        text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists documents_customer_idx on public.documents (customer_id);
create index if not exists documents_category_idx on public.documents (category);

alter table public.documents enable row level security;

drop policy if exists documents_team on public.documents;
create policy documents_team on public.documents
  for all using (public.is_active_user()) with check (public.is_active_user());

-- อัปเดตเวลาแก้ไขอัตโนมัติ
create or replace function public.touch_documents()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists documents_touch on public.documents;
create trigger documents_touch before update on public.documents
  for each row execute function public.touch_documents();

-- ---------- 2) ที่เก็บไฟล์แบบปิด ----------
insert into storage.buckets (id, name, public)
values ('docs', 'docs', false)
on conflict (id) do update set public = false;

-- เฉพาะคนที่ล็อกอินเท่านั้น (อ่าน/อัป/แก้/ลบ)
drop policy if exists "docs_auth_select" on storage.objects;
create policy "docs_auth_select" on storage.objects
  for select to authenticated using (bucket_id = 'docs');

drop policy if exists "docs_auth_insert" on storage.objects;
create policy "docs_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'docs');

drop policy if exists "docs_auth_update" on storage.objects;
create policy "docs_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'docs');

drop policy if exists "docs_auth_delete" on storage.objects;
create policy "docs_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'docs');
