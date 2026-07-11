import {
  ArrowLeft, Pencil, Bell, Palette, Search, Settings,
  ShieldCheck, ChevronRight, Home, Plus, LayoutGrid, User,
} from "lucide-react";

/* ---------- โทน soft-UI (ตัวอย่าง) ---------- */
const S = {
  bg: "linear-gradient(180deg,#ECEBF4 0%,#E7E6F0 100%)",
  card: "#FFFFFF",
  ink: "#141519",
  sub: "#8A8A97",
  line: "#EFEFF4",
  brand: "#014BAA",
  brandSoft: "#E7EEF7",
};
const SHADOW = "0 10px 30px rgba(83,80,120,.10)";
const SHADOW_SM = "0 6px 16px rgba(83,80,120,.08)";
const disp = "'Urbanist','Noto Sans Thai',system-ui,sans-serif";

function Tile({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button className="flex flex-1 flex-col items-center gap-2 rounded-3xl py-4"
      style={{ background: S.card, boxShadow: SHADOW_SM }}>
      <Icon size={22} strokeWidth={1.8} style={{ color: S.ink }} />
      <span style={{ color: S.sub, fontSize: 12.5, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

function Row({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <button className="flex w-full items-center justify-between px-5 py-4 text-left"
      style={{ borderTop: first ? "none" : `1px solid ${S.line}` }}>
      <span style={{ color: S.ink, fontSize: 15.5, fontWeight: 600 }}>{label}</span>
      <span className="flex items-center gap-1.5" style={{ color: S.sub, fontSize: 14.5 }}>
        {value} <ChevronRight size={17} style={{ color: "#C3C3CC" }} />
      </span>
    </button>
  );
}

function NavItem({ icon: Icon, label, active }: { icon: any; label: string; active?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <Icon size={22} strokeWidth={active ? 2.4 : 1.8} style={{ color: active ? S.brand : "#AFAFBA" }} />
      <span style={{ color: active ? S.ink : "#AFAFBA", fontSize: 12, fontWeight: active ? 700 : 600 }}>{label}</span>
    </div>
  );
}

export default function ProfileSoft() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pt-8"
      style={{ background: S.bg, fontFamily: disp }}>
      {/* ---------- header ---------- */}
      <div className="flex items-center gap-3">
        <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ background: S.card, boxShadow: SHADOW_SM }}>
          <ArrowLeft size={20} style={{ color: S.ink }} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: `linear-gradient(135deg,${S.brand},#0A6FD6)`, fontWeight: 800, fontSize: 17 }}>N</div>
          <div className="min-w-0">
            <div style={{ color: S.ink, fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>N Savoir</div>
            <div style={{ color: S.sub, fontSize: 13 }}>@owner · เจ้าของระบบ</div>
          </div>
        </div>
        <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: S.brand, boxShadow: "0 8px 20px rgba(1,75,170,.35)" }}>
          <Pencil size={19} />
        </button>
      </div>

      {/* ---------- quick actions ---------- */}
      <div className="mt-6 flex gap-3">
        <Tile icon={Bell} label="แจ้งเตือน" />
        <Tile icon={Palette} label="ธีม" />
        <Tile icon={Search} label="ค้นหา" />
        <Tile icon={Settings} label="ตั้งค่า" />
      </div>

      {/* ---------- settings list ---------- */}
      <div className="mt-5 overflow-hidden rounded-[26px]" style={{ background: S.card, boxShadow: SHADOW }}>
        <Row first label="ยืนยันตัวตน 2 ชั้น (2FA)" value="เปิด" />
        <Row label="การแจ้งเตือน" value="เปิด" />
        <Row label="ธีมของแอป" value="สว่าง" />
        <Row label="ความเป็นส่วนตัว" value="" />
      </div>

      {/* ---------- security note ---------- */}
      <div className="mt-5 flex items-center gap-3 rounded-3xl px-4 py-3.5"
        style={{ background: S.brandSoft }}>
        <ShieldCheck size={20} style={{ color: S.brand }} />
        <span style={{ color: S.brand, fontSize: 13, fontWeight: 600 }}>ทุกการเข้าดู/แก้ไข ถูกบันทึกใน Audit Log</span>
      </div>

      <div className="flex-1" />

      {/* ---------- bottom nav ---------- */}
      <div className="sticky bottom-0 -mx-5 mt-6 flex items-center px-6 pb-6 pt-4"
        style={{ background: S.card, boxShadow: "0 -8px 24px rgba(83,80,120,.10)", borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <NavItem icon={Home} label="หน้าหลัก" />
        <NavItem icon={Bell} label="แจ้งเตือน" />
        <div className="flex flex-1 justify-center">
          <button className="flex h-16 w-16 -translate-y-4 items-center justify-center rounded-full text-white"
            style={{ background: S.brand, boxShadow: "0 12px 26px rgba(1,75,170,.40)" }}>
            <Plus size={26} />
          </button>
        </div>
        <NavItem icon={LayoutGrid} label="หมวดงาน" />
        <NavItem icon={User} label="โปรไฟล์" active />
      </div>
    </div>
  );
}
