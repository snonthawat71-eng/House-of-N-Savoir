import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Bell, Lock, ChevronRight, LayoutGrid } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Carousel } from "@/components/Carousel";
import { TodoCard } from "./Notes";
import { GlobalSearch } from "./Search";

export type ModuleTile = { id: string; name: string; sub: string; icon: LucideIcon };

type Props = {
  brand: string;
  displayName: string;
  email: string;
  roleName: string;
  isAdmin: boolean;
  modules: ModuleTile[];
  onModule: (id: string) => void;
  onDashboard: () => void;
  onConnect: () => void;
  onNotes: () => void;
  /** หมวดที่ผู้ใช้คนนี้มีสิทธิ์ — ใช้จำกัดขอบเขตการค้นหา */
  mods: string[];
  go: (screen: string) => void;
  /** จอคอม: เมนูกับช่องค้นหาอยู่ในเปลือกนอกแล้ว หน้านี้ไม่ต้องมีหัวดำกับช่องค้นหาซ้ำ */
  desktop?: boolean;
};

/** หน้าแรก (Overview) — ยกเครื่องด้วย shadcn/ui */
export default function Overview({ brand, displayName, email, roleName, isAdmin, modules, onModule, onDashboard, onConnect, onNotes, mods, go, desktop }: Props) {
  // กำลังค้นอยู่ = ซ่อนการ์ดหมวดงานไว้ก่อน ให้ผลการค้นหาเต็มจอ (ใช้เฉพาะบนมือถือ)
  const [searching, setSearching] = useState(false);
  return (
    <div className={desktop ? "" : "pb-16"}>
      {/* หัวดำแบบเตี้ย — ข้อความ 3 บรรทัดเรียงข้างโลโก้ (มือถือเท่านั้น) */}
      {!desktop && (
      <div className="bg-ink px-5 pb-16" style={{ paddingTop: "calc(44px + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-white font-disp text-2xl font-extrabold text-ink">
            N
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-disp text-[11px] font-bold uppercase text-primary">{brand}</div>
            <div className="font-disp text-[18px] font-extrabold leading-tight tracking-tight text-white">{displayName}</div>
            <div className="truncate text-[10.5px] text-[#8A8F98]">{email} · {roleName}</div>
          </div>
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "#1E1F22" }}>
            <Bell size={18} className="text-[#9AA0A6]" />
          </button>
        </div>
      </div>
      )}

      {/* จอคอม: ช่องค้นหาอยู่บนสุด เหนือการ์ดงานที่ต้องทำ */}
      {desktop && (
        <div className="mb-5">
          <GlobalSearch mods={mods} go={go} onActive={setSearching} big />
        </div>
      )}

      {/* การ์ดเตือนงานวันนี้ (พับ/กางได้) — ซ้อนหัวดำ */}
      {!(desktop && searching) && (
        <div className={desktop ? "" : "-mt-10 px-5"}>
          <TodoCard onOpen={onNotes} />
        </div>
      )}

      {/* การ์ดเลื่อน — จอคอมวางเรียงกันไปเลย ไม่ต้องปัด */}
      {desktop && searching ? null : desktop ? (
        <div className="mt-4 grid grid-cols-2 gap-4">
          {isAdmin && (
            <Card onClick={onConnect} className="flex cursor-pointer items-center justify-between px-5 py-6">
              <div className="min-w-0">
                <div className="font-disp text-[19px] font-extrabold text-foreground">N Savoir Connect</div>
                <div className="mt-1 text-[12.5px] text-muted-foreground">ระบบจัดการสำหรับผู้บริหาร</div>
              </div>
              <Lock size={30} strokeWidth={1.8} className="ml-4 shrink-0 text-primary" />
            </Card>
          )}
          <Card className="flex items-center justify-between px-5 py-6">
            <div className="min-w-0">
              <div className="font-disp text-[19px] font-extrabold text-foreground">กิจกรรมล่าสุด</div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">เร็ว ๆ นี้</div>
            </div>
            <LayoutGrid size={30} strokeWidth={1.8} className="ml-4 shrink-0 text-foreground" />
          </Card>
        </div>
      ) : (
      <Carousel className="mt-3">
        {isAdmin && (
          <Card onClick={onConnect} className="flex cursor-pointer items-center justify-between px-5 py-6">
            <div className="min-w-0">
              <div className="font-disp text-[19px] font-extrabold text-foreground">N Savoir Connect</div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">ระบบจัดการสำหรับผู้บริหาร</div>
            </div>
            <div className="ml-4 shrink-0">
              <Lock size={30} strokeWidth={1.8} className="text-primary" />
            </div>
          </Card>
        )}
        <Card className="flex items-center justify-between px-5 py-6">
          <div className="min-w-0">
            <div className="font-disp text-[19px] font-extrabold text-foreground">กิจกรรมล่าสุด</div>
            <div className="mt-1 text-[12.5px] text-muted-foreground">เร็ว ๆ นี้</div>
          </div>
          <div className="ml-4 shrink-0">
            <LayoutGrid size={30} strokeWidth={1.8} className="text-foreground" />
          </div>
        </Card>
      </Carousel>
      )}

      <div className={desktop ? "mt-6" : "mt-6 px-5"}>
        {/* ค้นหาทั้งระบบ — มือถืออยู่ตรงนี้ · จอคอมย้ายขึ้นไปบนสุดแล้ว */}
        {!desktop && <GlobalSearch mods={mods} go={go} onActive={setSearching} />}

        {/* การ์ดหมวดงาน + Dashboard — ซ่อนไว้ตอนกำลังค้นหา */}
        {!searching && (
          <>
            <div className={`mt-4 grid gap-3 ${desktop ? "grid-cols-4 gap-4" : "grid-cols-2"}`}>
              {modules.map((m) => (
                <Card key={m.id} onClick={() => onModule(m.id)} className="cursor-pointer p-5">
                  <div className="mb-4 text-foreground">
                    <m.icon size={32} strokeWidth={1.8} />
                  </div>
                  <div className="font-disp text-lg font-bold text-foreground">{m.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{m.sub}</div>
                </Card>
              ))}
            </div>

            <Card onClick={onDashboard} className="mt-3 flex cursor-pointer items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
                <LayoutGrid size={26} strokeWidth={1.8} className="shrink-0 text-foreground" />
                <div className="font-disp text-[15px] font-bold text-foreground">Dashboard</div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
