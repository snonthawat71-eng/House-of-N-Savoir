-- =====================================================================
-- HOUSE OF N SAVOIR — ระบบเก็บไฟล์รูป (Supabase Storage)
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

-- สร้าง bucket "uploads" (เปิดสาธารณะให้แสดงรูปได้)
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = true;

-- อ่านรูปได้ทุกคน (bucket สาธารณะ)
drop policy if exists "uploads_public_read" on storage.objects;
create policy "uploads_public_read" on storage.objects
  for select using (bucket_id = 'uploads');

-- อัปโหลด/แก้/ลบ ได้เฉพาะผู้ล็อกอิน
drop policy if exists "uploads_auth_insert" on storage.objects;
create policy "uploads_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'uploads');

drop policy if exists "uploads_auth_update" on storage.objects;
create policy "uploads_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'uploads');

drop policy if exists "uploads_auth_delete" on storage.objects;
create policy "uploads_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'uploads');
