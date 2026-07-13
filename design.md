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

ใช้แล้วใน: B2C (ส่งสต็อก/ตัด/คืน), Note (เพิ่มงาน)

### ช่องมอบหมายคน

- dropdown **ไม่ต้องมีตัวเอง** — ค่าว่าง = งานของตัวเอง (label: "มอบหมายให้ (ไม่เลือก = งานของฉัน)")
- ตอนบันทึก ค่าว่างให้เก็บเป็น id ของตัวเอง

## 📐 การ์ด / เลย์เอาต์

- การ์ดขาว `rounded-2xl`–`rounded-3xl` เงานุ่ม `shadow-sm`
- ไอคอนตกแต่งเป็นเส้น (lucide, `strokeWidth 1.8`) **ไม่มีพื้นรอง**
- ระยะห่างระหว่างการ์ด/ปุ่มในหน้าเดียวกันให้เท่ากัน (`mt-4` เป็นหลัก)
- มือถือเป็นหลัก: ปุ่มกดง่ายด้วยนิ้วโป้ง แถบเมนูลอยสีดำด้านล่าง

## 🔔 Toast

ทุกการทำรายการ (บันทึก/ลบ/ติ๊กเสร็จ) ต้องเรียก `toast.success(...)` / `toast.error(...)` จาก `src/lib/toast.tsx`
