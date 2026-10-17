/**
 * หน้าตาสำหรับจอคอม — เมนูดำฝั่งซ้าย + แถบบนมีชื่อหน้ากับช่องค้นหา
 * เนื้อหาหน้าต่าง ๆ ใช้ของเดิมทั้งหมด แค่มาอยู่ในพื้นที่ที่กว้างขึ้น
 * บนมือถือไม่ได้ใช้ไฟล์นี้ (ยังเป็นแอปแบบเดิม)
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft } from "lucide-react";
import { C } from "../lib/ui";

export type SideItem = { id: string; label: string; icon: LucideIcon; onClick?: () => void };
export type SideGroup = { label: string; items: SideItem[] };

export function DesktopShell({
  groups, active, title, sub, onNav, onBack, user, search, children,
}: {
  groups: SideGroup[];
  active: string;
  title: string;
  sub?: string;
  onNav: (id: string) => void;
  onBack?: () => void;
  user: { name: string; role: string };
  search?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen-safe" style={{ background: C.bg }}>
      {/* ---------- เมนูซ้าย ---------- */}
      <aside className="sticky top-0 flex h-screen w-[252px] shrink-0 flex-col gap-1 overflow-y-auto px-3.5 py-5 text-white"
        style={{ background: C.ink }}>
        <div className="flex items-center gap-3 px-2 pb-4 pt-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-white font-disp text-xl font-extrabold"
            style={{ color: C.ink }}>N</div>
          <div className="min-w-0">
            <div className="font-disp text-[9.5px] font-bold uppercase tracking-[.1em]" style={{ color: "#4D8FE8" }}>House of</div>
            <div className="font-disp text-[15px] font-extrabold leading-tight">N SAVOIR</div>
          </div>
        </div>

        {groups.filter((g) => g.items.length).map((g) => (
          <div key={g.label}>
            <div className="px-3 pb-1.5 pt-4 text-[10.5px] font-bold uppercase tracking-[.12em]" style={{ color: "#5E646D" }}>
              {g.label}
            </div>
            {g.items.map((it) => {
              const on = it.id === active;
              return (
                <button key={it.id} onClick={() => (it.onClick ? it.onClick() : onNav(it.id))}
                  className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-[14px] font-semibold transition-colors"
                  style={{ background: on ? "#1E1F22" : "transparent", color: on ? "#fff" : "#A8AEB6" }}>
                  <it.icon size={18} strokeWidth={1.9} className="shrink-0" />
                  <span className="truncate">{it.label}</span>
                </button>
              );
            })}
          </div>
        ))}

        <div className="mt-auto flex items-center gap-2.5 rounded-2xl p-3" style={{ background: "#1A1B1E" }}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-white font-disp text-[13px] font-extrabold"
            style={{ color: C.ink }}>{(user.name || "?").trim().charAt(0)}</div>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-bold">{user.name}</div>
            <div className="truncate text-[10.5px]" style={{ color: "#7B818A" }}>{user.role}</div>
          </div>
        </div>
      </aside>

      {/* ---------- ฝั่งเนื้อหา ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-white px-7"
          style={{ borderColor: C.line }}>
          {onBack && (
            <button onClick={onBack} aria-label="ย้อนกลับ"
              className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: C.bg }}>
              <ChevronLeft size={18} style={{ color: C.ink }} />
            </button>
          )}
          <div className="min-w-[150px] shrink-0">
            <div className="font-disp text-[16px] font-extrabold leading-tight" style={{ color: C.ink }}>{title}</div>
            {sub && <div className="text-[11.5px]" style={{ color: C.sub }}>{sub}</div>}
          </div>
          {search && <div className="min-w-0 flex-1" style={{ maxWidth: 580 }}>{search}</div>}
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-5xl px-7 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
