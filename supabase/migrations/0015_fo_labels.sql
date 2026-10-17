-- =====================================================================
-- HOUSE OF N SAVOIR — Office > Print > FO Label
-- สติกเกอร์ฉลากสารเคมี (ขนาดแนะนำ 152.4 x 101.6 mm = 6 x 4 นิ้ว)
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run
-- =====================================================================

create table if not exists public.fo_labels (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,                         -- NS11961543 (บังคับ)
  name          text not null,                         -- IRIS MUSK (SOLISSE) (บังคับ)
  gross_min     text not null,                         -- 1kg116 (บังคับ)
  tare_min      text not null,                         -- 0kg116 (บังคับ)
  net           text not null,                         -- 1kg000 (บังคับ)
  mfg_date      date not null,                         -- วันผลิต
  bbe_date      date not null,                         -- หมดอายุ = วันผลิต + 2 ปี
  batch_of      text not null,                         -- 0F2613B0400 (บังคับ) = ค่าที่อยู่ใน Data Matrix
  signal_word   text not null default 'DANGER'
                check (signal_word in ('DANGER', 'WARNING')),
  pictograms    text[] not null default '{}',          -- รหัสสัญลักษณ์ GHS เช่น {GHS02,GHS05,GHS07,GHS09}
  hp_codes      text,                                  -- บรรทัดรหัส H/P
  storage_text  text,                                  -- บรรทัดวิธีเก็บรักษา
  customer_id   uuid references public.customers (id) on delete set null,
  customer_name text,                                  -- เก็บชื่อซ้ำไว้ กันลูกค้าถูกลบแล้วประวัติหาย
  note          text,
  width_mm      numeric not null default 152.4,
  height_mm     numeric not null default 101.6,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ค้นหาเร็วตอนสแกน Data Matrix (ยิงได้เลข Batch (OF) แล้วมาเปิดดูข้อมูลเต็มในแอป)
create index if not exists fo_labels_batch_idx   on public.fo_labels (lower(batch_of));
create index if not exists fo_labels_created_idx on public.fo_labels (created_at desc);

-- อัปเดตเวลาแก้ไขอัตโนมัติ (ใช้ฟังก์ชันเดิมที่สร้างไว้ตอนทำ Batch Label)
drop trigger if exists fo_labels_touch on public.fo_labels;
create trigger fo_labels_touch before update on public.fo_labels
  for each row execute function public.touch_batch_labels();

-- สิทธิ์: ทีม (ผู้ใช้ที่ยังใช้งานอยู่) เท่านั้น
alter table public.fo_labels enable row level security;
drop policy if exists fo_labels_team on public.fo_labels;
create policy fo_labels_team on public.fo_labels
  for all using (public.is_active_user()) with check (public.is_active_user());
