/**
 * หน้าตาสำหรับจอคอม
 *  - แถบดำด้านบน มีโลโก้อยู่กลาง
 *  - เมนูลอยอยู่กลางล่างของจอ แบบเดียวกับแอปมือถือ แต่ใหญ่กว่า
 *  - เนื้อหาหน้าต่าง ๆ ใช้ของเดิมทั้งหมด แค่มาอยู่ในพื้นที่ที่กว้างขึ้น
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
      {/* ---------- แถบบนสีดำ โลโก้อยู่กลาง ---------- */}
      <header className="sticky top-0 z-30 flex h-[88px] items-center justify-center px-9" style={{ background: C.ink }}>
        <img src="/logo-wordmark.svg" alt="HOUSE OF N SAVOIR" style={{ height: 21 }} />
      </header>

      {/* ---------- เนื้อหา (เผื่อที่ด้านล่างให้เมนูลอย) ---------- */}
      <div className="mx-auto w-full max-w-[1080px] px-6 pb-32 pt-7">
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

      {/* ---------- เมนูลอยกลางล่าง แบบเดียวกับแอปมือถือ ---------- */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-6">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full p-2.5"
          style={{ background: C.ink, boxShadow: "0 12px 34px rgba(0,0,0,.28)" }}>
          {items.map((n) => {
            const on = n.id === active;
            return (
              <button key={n.id} onClick={() => onNav(n.id)} aria-label={n.label}
                className="flex items-center gap-2.5 rounded-full transition-all"
                style={{ background: on ? C.brand : "transparent", padding: on ? "13px 22px" : "13px 17px" }}>
                <n.icon size={23} style={{ color: on ? "#fff" : "#9AA0A6" }} />
                {on && <span style={{ color: "#fff", fontSize: 15.5, fontWeight: 600 }}>{n.label}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
