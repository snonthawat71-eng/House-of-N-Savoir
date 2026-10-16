-- =====================================================================
-- HOUSE OF N SAVOIR — Office > Print > Batch Label
-- สติกเกอร์ติดส่งลูกค้า 80x50mm + เก็บประวัติทุกใบที่สร้าง
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

create table if not exists public.batch_labels (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,                                             -- ชื่อรายการ (บังคับ)
  product_id    uuid references public.products (id)  on delete set null,  -- ถ้าเลือกจาก Product List
  code          text,                                                      -- CODE (ไม่บังคับ)
  batch_no      text not null,                                             -- BATCH NO (บังคับ) = ค่าที่อยู่ใน Data Matrix
  mfg_date      date not null,                                             -- วันผลิต (บังคับ)
  exp_date      date not null,                                             -- วันหมดอายุ (ปกติ +2 ปีจากวันผลิต)
  quantity      integer not null check (quantity > 0),                     -- จำนวน (บังคับ)
  customer_id   uuid references public.customers (id) on delete set null,
  customer_name text,                                   -- เก็บชื่อซ้ำไว้ กันลูกค้าถูกลบแล้วประวัติหาย
  note          text,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ค้นหาเร็วตอนสแกน Data Matrix (ยิงได้ BATCH NO แล้วมาเปิดดูข้อมูลเต็มในแอป)
create index if not exists batch_labels_batch_no_idx on public.batch_labels (lower(batch_no));
create index if not exists batch_labels_created_idx  on public.batch_labels (created_at desc);

-- อัปเดตเวลาแก้ไขอัตโนมัติ
create or replace function public.touch_batch_labels()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists batch_labels_touch on public.batch_labels;
create trigger batch_labels_touch before update on public.batch_labels
  for each row execute function public.touch_batch_labels();

-- สิทธิ์: ทีม (ผู้ใช้ที่ยังใช้งานอยู่) เท่านั้น
alter table public.batch_labels enable row level security;
drop policy if exists batch_labels_team on public.batch_labels;
create policy batch_labels_team on public.batch_labels
  for all using (public.is_active_user()) with check (public.is_active_user());
