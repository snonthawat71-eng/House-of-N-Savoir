---
name: shadcn-ui
description: ใช้เมื่อจะเพิ่ม/แก้ไข/ค้นหา UI ของโปรเจกต์นี้ด้วย shadcn/ui — ปุ่ม การ์ด dialog dropdown input form table toast ฯลฯ. อธิบายวิธีเพิ่มคอมโพเนนต์ผ่าน shadcn MCP หรือ CLI, path alias, และธีมสีของ House of N Savoir (สีหลัก = แดง #E5322A).
---

# shadcn/ui ในโปรเจกต์ House of N Savoir

โปรเจกต์นี้ตั้งค่า **shadcn/ui** ไว้แล้ว (Vite + React + TS + Tailwind v3). ใช้ได้ทันที.

## การตั้งค่าที่มีอยู่แล้ว (ห้ามตั้งซ้ำ)
- `components.json` — style `new-york`, baseColor `neutral`, cssVariables เปิด
- path alias `@` → `src/` (ตั้งใน `tsconfig.json` และ `vite.config.ts`)
- ยูทิล `cn()` อยู่ที่ **`@/lib/cn`** (ไม่ใช่ `@/lib/utils`) — คอมโพเนนต์ที่ CLI สร้างจะ import จากที่นี่
- ตัวแปรธีมอยู่ใน `src/index.css` (`:root` และ `.dark`), map สีใน `tailwind.config.js`
- คอมโพเนนต์ใหม่จะถูกวางที่ **`src/components/ui/`**
- MCP server ชื่อ `shadcn` ตั้งไว้ใน `.mcp.json`

## ธีมสี (สำคัญ — ให้เข้ากับแบรนด์)
- `--primary` = **แดงแบรนด์ #E5322A** → `<Button>` เริ่มต้นจะเป็นสีแดง
- โทนอื่น: พื้นเทาอ่อน, การ์ดขาว, ตัวหนังสือดำ #111214, มุมโค้งใหญ่ (`--radius: 1rem`)
- ฟอนต์: หัวข้อ/ตัวเลข `font-disp` (Plus Jakarta Sans), เนื้อหา `font-sans` (Inter)

## วิธีเพิ่มคอมโพเนนต์

### ทางที่ 1 — ผ่าน shadcn MCP (แนะนำเมื่อทำงานกับ Claude)
เครื่องมือที่ใช้บ่อย:
- `search_items_in_registries` — ค้นหาคอมโพเนนต์ (เช่น "dialog", "data table")
- `view_items_in_registries` — ดูโค้ด/รายละเอียดก่อนติดตั้ง
- `get_item_examples_from_registries` — ดูตัวอย่างการใช้งาน
- `get_add_command_for_items` — ได้คำสั่งติดตั้งที่ถูกต้อง
แล้วรันคำสั่ง add ที่ได้มา

### ทางที่ 2 — ผ่าน CLI
```bash
npx shadcn@latest add button card dialog input label select
```
> คำสั่งนี้ต้องต่อเน็ตไปที่ `ui.shadcn.com` ได้ (บนเครื่อง dev/CI ปกติทำได้ — แต่แซนด์บ็อกซ์บางตัวถูกบล็อก ถ้าโดนบล็อกให้เขียนไฟล์คอมโพเนนต์เองจากโค้ดทางการ)

## วิธีใช้ในโค้ด
```tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

<Button>บันทึก</Button>                 // แดงแบรนด์
<Button variant="outline">ยกเลิก</Button>
<Button variant="ghost" size="icon">…</Button>
```

## กติกาของโปรเจกต์นี้
- แอปเดิมส่วนใหญ่ใช้ **inline style** ตามพาเลตต์ใน `src/lib/ui.ts` — เมื่อเพิ่มคอมโพเนนต์ shadcn ให้คุมโทนให้กลมกลืน (แดง/ดำ/เทา/การ์ดขาว มุมโค้งใหญ่)
- ห้ามใส่คีย์ลับในโค้ด, สรุปงานเป็นภาษาไทยแบบเข้าใจง่าย (ดู `CLAUDE.md`)
- ทดสอบด้วย `npm run build` ทุกครั้งหลังเพิ่มคอมโพเนนต์
