# design.md — HOUSE OF N SAVOIR (มาตรฐานดีไซน์)

> คู่มือดีไซน์ของแอป — เพิ่ม/แก้ UI ทุกครั้งให้ยึดตามนี้

## 🎨 สีแบรนด์

| ชื่อ | ค่า | ใช้กับ |
|---|---|---|
| Royal Blue (brand) | `#014BAA` | สีหลัก ปุ่มยืนยัน ลิงก์ ตัวเลขเด่น เวลา |
| Blue Soft | `#E7EEF7` | พื้นจางของสีหลัก (ป้าย/ไอคอนวงกลม) |
| Imperial Blue | `#001D51` | น้ำเงินเข้มพิเศษ |
| Light Cream | `#F8F3F0` | ครีมอ่อน |
| Ink | `#111214` | ตัวหนังสือหลัก แถบดำ เมนูล่าง |
| BG | `#F1F2F4` | พื้นหลังแอป |
| Red | `#E5322A` | **เฉพาะ** error / ลบ / เลยกำหนด / เตือน |
| Green | `#16A45C` | ตัวเลขบวก / สำเร็จ |

โทเคนสีอยู่ที่ `src/lib/ui.ts` (ตัวแปร `C`) และ CSS variables ใน `src/index.css`

## ✍️ ฟอนต์

- หัวข้อ/ตัวเลข: **Urbanist** (หนา 700–800) → คลาส `font-disp`
- เนื้อหาไทย: **Noto Sans Thai** (อยู่ใน fallback ของทุกฟอนต์)
- รหัส/บาร์โค้ด: **Space Mono** → ตัวแปร `mono`

## 🧩 มาตรฐานฟอร์ม

- ช่องกรอกทุกช่อง: พื้นขาว ขอบ `1px solid #EAECEF` มุมโค้ง `rounded-2xl` ระยะ `px-4 py-3` (`inputStyle` จาก `src/lib/ui.ts`)
- โฟกัสแล้วขอบเป็นสีแบรนด์ + แสงฟ้าจาง (ตั้งไว้ global ใน `index.css`)
- ปุ่มบันทึก: เต็มความกว้าง สีแบรนด์ `rounded-2xl py-6`
- ปุ่มลบ: อยู่ **ท้ายฟอร์มแก้ไข** เท่านั้น (ไม่อยู่หน้ารายละเอียด) ใช้ `<DeleteButton>` จาก `src/components/ui/modal.tsx` — พื้นแดงจาง ตัวแดง มีไอคอนถังขยะ โผล่เฉพาะตอนแก้ของเดิม

### ช่องวันที่ / เวลา (มาตรฐาน — ใช้ทุกฟอร์ม)

ช่อง `type="date"` และ `type="time"` ต้องทำแบบนี้เสมอ เพื่อไม่ให้ล้น/ซ้อนกันบนมือถือ และล้างค่าได้:

1. ครอบสองช่องด้วย grid: `grid grid-cols-2 gap-3 [&>*]:min-w-0`
2. แต่ละช่องห่อด้วย `<div className="relative min-w-0">`
3. input ใช้คลาส: `box-border w-full min-w-0 appearance-none rounded-2xl px-3 py-3 pr-8 text-[13px]` + `style={inputStyle}`
4. มี **ปุ่ม ✕ ล้างค่า** ลอยขวาในช่อง แสดงเมื่อมีค่า:

```tsx
const ClearBtn = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} aria-label="ล้าง"
    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-muted-foreground">
    <X size={13} />
  </button>
);

<div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
  <Field label="กำหนดวัน">
    <div className="relative min-w-0">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
        className="box-border w-full min-w-0 appearance-none rounded-2xl px-3 py-3 pr-8 text-[13px]" style={inputStyle} />
      {date && <ClearBtn onClick={() => setDate("")} />}
    </div>
  </Field>
  <Field label="เวลา">
    <div className="relative min-w-0">
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
        className="box-border w-full min-w-0 appearance-none rounded-2xl px-3 py-3 pr-8 text-[13px]" style={inputStyle} />
      {time && <ClearBtn onClick={() => setTime("")} />}
    </div>
  </Field>
</div>
```

ใช้แล้วใน: B2C (เติมสต็อก/ตัด/คืน), Note (เพิ่มงาน)

### ช่องมอบหมายคน

- dropdown **ไม่ต้องมีตัวเอง** — ค่าว่าง = งานของตัวเอง (label: "มอบหมายให้ (ไม่เลือก = งานของฉัน)")
- ตอนบันทึก ค่าว่างให้เก็บเป็น id ของตัวเอง

### กติกาฟอร์มงาน/โน้ต (Note)

- **บังคับกำหนดวันและเวลา** ทุกงาน — ถ้าไม่กรอกให้ขึ้น error "ต้องกำหนดวันและเวลา"

## ✅ การ์ดรายการงาน (task row) — มาตรฐาน

เลย์เอาต์การ์ดงานในหน้า Note และการ์ดเตือนบน Overview:

- แถวเนื้อหา: **ปุ่ม check → เวลา → ชื่องาน** (ปุ่ม check อยู่หน้าเวลาเสมอ)
- **วันที่โชว์จุดเดียว** — บนการ์ดเตือน Overview เท่านั้น: แถวบนสุด **ตัวเทาเล็ก ไม่เด่น** ไอคอนปฏิทิน + วันที่จริง (เช่น "13 ก.ค. 2569") — **ห้ามใช้คำว่า "วันนี้/พรุ่งนี้"** ทุกที่ให้เขียนเป็นวันที่จริงเสมอ (หัวกลุ่มหน้า Note ด้วย)
  ในหน้า Note **ไม่ใส่วันที่ในการ์ดแต่ละรายการ** เพราะหัวกลุ่มบอกวันอยู่แล้ว · งานเลยกำหนดมีป้ายแดง "เลยกำหนด" ข้างวันที่
- **ปุ่ม check ทรงวงกลม 2 สถานะ**:
  - ยังไม่เสร็จ = วงกลม**โปร่งเปล่า** (`border-2` สีเทา `#C9CDD3` พื้นใส ไม่มีไอคอน)
  - เสร็จแล้ว/กดติ๊ก = วงกลม**ทึบ**สีแบรนด์ `#014BAA` + ไอคอน check สีขาว + ชื่องานขีดฆ่าเป็นสีเทา
  - บนการ์ดเตือน Overview: กดแล้วติ๊กทึบให้เห็นแวบหนึ่ง (~250ms) ก่อนเด้งงานถัดไป
- เวลาใช้ `font-disp` หนา `tabular-nums` สีแบรนด์ (เลยกำหนด = สีแดง, เสร็จแล้ว = สีเทา)

## 📐 การ์ด / เลย์เอาต์

- การ์ดขาว `rounded-2xl`–`rounded-3xl` เงานุ่ม `shadow-sm`
- ไอคอนตกแต่งเป็นเส้น (lucide, `strokeWidth 1.8`) **ไม่มีพื้นรอง**
- ระยะห่างระหว่างการ์ด/ปุ่มในหน้าเดียวกันให้เท่ากัน (`mt-4` เป็นหลัก)
- มือถือเป็นหลัก: ปุ่มกดง่ายด้วยนิ้วโป้ง แถบเมนูลอยสีดำด้านล่าง

## 🔔 Toast

ทุกการทำรายการ (บันทึก/ลบ/ติ๊กเสร็จ) ต้องเรียก `toast.success(...)` / `toast.error(...)` จาก `src/lib/toast.tsx`
