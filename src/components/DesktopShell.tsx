/**
 * หน้าตาสำหรับจอคอม — แถบดำด้านบนเต็มความกว้าง + เนื้อหาอยู่กลางจอ
 * เนื้อหาหน้าต่าง ๆ ใช้ของเดิมทั้งหมด แค่มาอยู่ในพื้นที่ที่กว้างขึ้น
 * บนมือถือไม่ได้ใช้ไฟล์นี้ (ยังเป็นแอปแบบเดิม)
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft } from "lucide-react";
import { C } from "../lib/ui";

export type TopItem = { id: string; label: string; icon: LucideIcon };

export function DesktopShell({
  items, active, brand, user, title, onNav, onBack, children,
}: {
  items: TopItem[];
  active: string;
  brand: string;
  user: { name: string; role: string };
  /** ชื่อหน้า — โชว์เฉพาะหน้าย่อย (หน้าแรกไม่ต้อง) */
  title?: string;
  onNav: (id: string) => void;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen-safe" style={{ background: C.bg }}>
      {/* ---------- แถบบนสีดำ ---------- */}
      <header className="sticky top-0 z-30 flex h-[66px] items-center gap-4 px-8" style={{ background: C.ink }}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white font-disp text-xl font-extrabold"
          style={{ color: C.ink }}>N</div>
        <div className="min-w-0">
          <div className="font-disp text-[10.5px] font-bold uppercase tracking-[.09em] text-primary">{brand}</div>
          <div className="truncate font-disp text-[15px] font-extrabold text-white">
            {user.name} · <span style={{ color: "#8A8F98" }}>{user.role}</span>
          </div>
        </div>
        <div className="flex-1" />
        <nav className="flex items-center gap-1.5">
          {items.map((n) => {
            const on = n.id === active;
            return (
              <button key={n.id} onClick={() => onNav(n.id)}
                className="flex items-center gap-2 rounded-[14px] px-3.5 py-2 text-[14px] font-semibold transition-colors"
                style={{ background: on ? "#1E1F22" : "transparent", color: on ? "#fff" : "#A8AEB6" }}>
                <n.icon size={17} strokeWidth={1.9} />
                <span>{n.label}</span>
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
