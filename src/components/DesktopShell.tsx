/**
 * หน้าตาสำหรับจอคอม — แถบดำด้านบนเต็มความกว้าง + เนื้อหาอยู่กลางจอ
 * เมนูใช้แบบเดียวกับแถบล่างบนมือถือ (ปุ่มที่เลือกอยู่เป็นแคปซูลน้ำเงินมีชื่อกำกับ) แต่ใหญ่กว่า
 * เนื้อหาหน้าต่าง ๆ ใช้ของเดิมทั้งหมด แค่มาอยู่ในพื้นที่ที่กว้างขึ้น
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft } from "lucide-react";
import { C } from "../lib/ui";

export type TopItem = { id: string; label: string; icon: LucideIcon };

export function DesktopShell({
  items, active, title, onNav, onBack, children,
}: {
  items: TopItem[];
  active: string;
  /** ชื่อหน้า — โชว์เฉพาะหน้าย่อย (หน้าแรกไม่ต้อง) */
  title?: string;
  onNav: (id: string) => void;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen-safe" style={{ background: C.bg }}>
      {/* ---------- แถบบนสีดำ ---------- */}
      <header className="sticky top-0 z-30 flex h-[88px] items-center gap-6 px-9" style={{ background: C.ink }}>
        <img src="/logo-wordmark.svg" alt="HOUSE OF N SAVOIR" className="shrink-0" style={{ height: 21 }} />
        <div className="flex-1" />
        {/* เมนูแบบเดียวกับแถบล่างของแอปมือถือ แต่ใหญ่ขึ้น */}
        <nav className="flex items-center gap-1 rounded-full p-2" style={{ background: "#1E1F22" }}>
          {items.map((n) => {
            const on = n.id === active;
            return (
              <button key={n.id} onClick={() => onNav(n.id)} aria-label={n.label}
                className="flex items-center gap-2.5 rounded-full transition-all"
                style={{ background: on ? C.brand : "transparent", padding: on ? "12px 20px" : "12px 15px" }}>
                <n.icon size={22} style={{ color: on ? "#fff" : "#9AA0A6" }} />
                {on && <span style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>{n.label}</span>}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ---------- เนื้อหา ---------- */}
      <div className="mx-auto w-full max-w-[1080px] px-6 py-7">
        {title && (
          <div className="mb-5 flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} aria-label="ย้อนกลับ"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card shadow-sm">
                <ChevronLeft size={19} style={{ color: C.ink }} />
              </button>
            )}
            <h1 className="font-disp text-[24px] font-extrabold tracking-tight" style={{ color: C.ink }}>{title}</h1>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
