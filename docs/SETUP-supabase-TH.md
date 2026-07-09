# คู่มือตั้งค่า Supabase — เฟส 0 (ล็อกอินจริง)

> ทำตามทีละขั้น ไม่ต้องรีบ ทำผิดตรงไหนทักได้เลย

## ขั้นที่ 1 — สมัคร Supabase + สร้างโปรเจกต์
1. เข้า https://supabase.com → กด **Start your project** → เข้าสู่ระบบด้วย GitHub หรืออีเมล
2. กด **New project**
3. ตั้งชื่อโปรเจกต์: `house-of-n-savoir`
4. ตั้ง **Database Password** (ตั้งรหัสยาก ๆ แล้วจดเก็บไว้)
5. **Region** เลือก **Southeast Asia (Singapore)**
6. กด **Create new project** แล้วรอ ~2 นาที

## ขั้นที่ 2 — เอา "กุญแจ 2 ดอก" มาใส่ในแอป
1. เมนูซ้าย → **Project Settings** (รูปเฟือง) → **API**
2. คัดลอก 2 ค่านี้:
   - **Project URL**
   - **anon public** key
3. สร้างไฟล์ชื่อ `.env` ที่โฟลเดอร์หลักของโปรเจกต์ (ก๊อปจาก `.env.example`) แล้วใส่ค่า:
   ```
   VITE_SUPABASE_URL=<Project URL>
   VITE_SUPABASE_ANON_KEY=<anon public key>
   ```
> ไฟล์ `.env` เป็นความลับ ไม่ถูกส่งขึ้น GitHub

## ขั้นที่ 3 — สร้างตารางฐานข้อมูล + กติกาความปลอดภัย
1. เมนูซ้าย → **SQL Editor** → **New query**
2. เปิดไฟล์ `supabase/migrations/0001_init.sql` ในโปรเจกต์ คัดลอกทั้งหมดไปวาง
3. กด **Run** (มุมขวาล่าง) — ควรขึ้น Success
> ไฟล์นี้จะสร้างตาราง `profiles`, `allowed_emails`, `audit_log`, เปิด RLS และเชิญอีเมลเจ้าของไว้แล้ว

## ขั้นที่ 4 — เปิดล็อกอินด้วย Google
1. ต้องมี **Google OAuth Client** ก่อน (ทำที่ Google Cloud Console):
   - เข้า https://console.cloud.google.com → สร้างโปรเจกต์ใหม่
   - **APIs & Services** → **OAuth consent screen** → เลือก **External** → กรอกชื่อแอป/อีเมล → Save
   - **Credentials** → **Create Credentials** → **OAuth client ID** → Application type: **Web application**
   - **Authorized redirect URIs** ใส่: `https://<project-ref>.supabase.co/auth/v1/callback`
     (เอา `<project-ref>` จาก Project URL)
   - กด Create → จะได้ **Client ID** และ **Client Secret**
2. กลับมาที่ Supabase → **Authentication** → **Providers** → **Google**
   - เปิด (Enable) → วาง **Client ID** + **Client Secret** → **Save**
3. **Authentication** → **URL Configuration** → **Site URL** ใส่ `http://localhost:5173`
   (ตอนขึ้นเว็บจริงค่อยเพิ่มโดเมนจริง)

## ขั้นที่ 5 — ทดสอบ
1. รันแอป: `npm run dev` → เปิด http://localhost:5173
2. กด **เข้าสู่ระบบด้วย Google** → เลือกบัญชีอีเมลเจ้าของ
3. ถ้าเข้าได้ = สำเร็จ! ถ้าใช้อีเมลที่ไม่ได้เชิญ = ระบบจะบล็อก

## เชิญคนอื่นเพิ่มทีหลัง
ไปที่ SQL Editor แล้วรัน (แก้อีเมล/role ตามจริง):
```sql
insert into public.allowed_emails (email, role, full_name)
values ('someone@example.com', 'manager', 'ชื่อ')
on conflict (email) do update set role = excluded.role, active = true;
```
role ที่ใช้ได้: `owner`, `dev`, `manager`, `sales`
