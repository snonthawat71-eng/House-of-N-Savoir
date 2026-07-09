-- =====================================================================
-- HOUSE OF N SAVOIR — แก้ปัญหา "Database error saving new user"
-- ทำให้การสร้างบัญชีผู้ใช้ "ไม่ล้มเหลว" ไม่ว่าอะไรจะเกิดขึ้น
-- แล้วค่อยเช็กสิทธิ์ (invite) ที่ระดับโปรไฟล์แทน
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

-- ---------- 1) ยืนยันว่าอีเมลเจ้าของถูกเชิญไว้แน่นอน ----------
insert into public.allowed_emails (email, role, full_name)
values ('s.nonthawat71@gmail.com', 'owner', 'เจ้าของ')
on conflict (email) do update set role = 'owner', active = true;

-- ---------- 2) เขียน trigger ใหม่แบบทนทาน (ไม่ throw error) ----------
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
  where lower(email) = lower(new.email) and active = true
  limit 1;

  begin
    if found then
      -- อีเมลได้รับเชิญ → สร้างโปรไฟล์พร้อม role และเปิดใช้งาน
      insert into public.profiles (id, email, full_name, role, active)
      values (
        new.id, new.email,
        coalesce(allowed.full_name, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
        allowed.role, true
      )
      on conflict (id) do update
        set email = excluded.email, role = excluded.role, active = true;
    else
      -- ยังไม่ได้รับเชิญ → สร้างโปรไฟล์ไว้แต่ปิดใช้งาน (active=false) แอปจะบล็อกเอง
      insert into public.profiles (id, email, full_name, role, active)
      values (
        new.id, new.email,
        coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
        'sales', false
      )
      on conflict (id) do nothing;
    end if;
  exception when others then
    -- ถ้าสร้างโปรไฟล์พลาดด้วยเหตุใดก็ตาม ห้ามทำให้การสมัคร user ล้มเหลว
    null;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 3) เติมโปรไฟล์ให้ผู้ใช้ที่ล็อกอินไปแล้วก่อนหน้านี้ ----------
insert into public.profiles (id, email, full_name, role, active)
select u.id, u.email,
       coalesce(a.full_name, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
       a.role, true
from auth.users u
join public.allowed_emails a
  on lower(a.email) = lower(u.email) and a.active = true
on conflict (id) do update set role = excluded.role, active = true;
