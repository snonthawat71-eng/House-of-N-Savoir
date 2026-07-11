import React, { useState, useRef, useEffect } from "react";
import {
  Home, Package, Bell, User, Search, Lock, ShieldCheck, ChevronRight,
  Building2, Handshake, Store, Factory, FlaskConical, ScrollText,
  ArrowLeft, TrendingUp, TrendingDown, Truck, FileText, AlertTriangle,
  RotateCcw, Boxes, MapPin, CalendarClock, Eye, ChevronDown, Check,
  Fingerprint, Plus, SlidersHorizontal, KeyRound, ArrowUpRight, LayoutGrid,
  LogOut, Loader2, Settings
} from "lucide-react";
import { useAuth } from "./lib/auth";
import { isSupabaseConfigured } from "./lib/supabase";
import { NavCtx } from "./lib/nav";
import MfaGate from "./MfaGate";
import UsersAdmin from "./UsersAdmin";
import ProductsScreen from "./ProductsScreen";
import AuditScreen from "./AuditScreen";
import B2BReal from "./screens/B2B";
import B2CReal from "./screens/B2C";
import SupplierReal from "./screens/Supplier";
import OfficeReal from "./screens/Office";
import FormulaLabReal from "./screens/FormulaLab";
import DashboardReal from "./screens/Dashboard";
import AlertsReal from "./screens/Alerts";
import ImportScreen from "./screens/Import";
import Overview from "./screens/Overview";

/* ------------------------------------------------------------------ *
 *  HOUSE OF N SAVOIR — Internal Superapp (clickable mockup)
 *  Skin: fintech-clean · cream / black / gray / royal blue
 * ------------------------------------------------------------------ */

const C = {
  bg: "#F1F2F4", card: "#FFFFFF",
  ink: "#111214", ink2: "#1A1B1E",
  sub: "#8A8F98", line: "#EAECEF",
  brand: "#014BAA", brandSoft: "#E7EEF7",
  imperial: "#001D51", cream: "#F8F3F0",
  red: "#E5322A", redSoft: "#FDECEA",
  green: "#16A45C", greenSoft: "#E7F5EE",
};
const SHADOW = "0 1px 2px rgba(17,18,20,.04), 0 8px 24px rgba(17,18,20,.06)";
const SHADOW_SM = "0 1px 2px rgba(17,18,20,.05), 0 4px 12px rgba(17,18,20,.05)";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
`;
const disp = "'Urbanist', 'Noto Sans Thai', system-ui, sans-serif";
const sans = "'Urbanist', 'Noto Sans Thai', system-ui, sans-serif";
const mono = "'Space Mono', ui-monospace, monospace";

/* ---------------- roles & permissions ---------------- */
const ROLES = {
  owner:   { name: "เจ้าของ", en: "Owner",           finance: true,  cost: true,  formula: true,  audit: true,  mods: ["office","b2b","b2c","supplier"] },
  dev:     { name: "Dev Support", en: "Dev Support", finance: true,  cost: true,  formula: true,  audit: true,  mods: ["office","b2b","b2c","supplier"] },
  manager: { name: "ผู้จัดการ", en: "Manager",       finance: true,  cost: true,  formula: false, audit: false, mods: ["office","b2b","b2c","supplier"] },
  sales:   { name: "ฝ่ายขาย/แอดมิน", en: "Sale/Admin", finance: false, cost: false, formula: false, audit: false, mods: ["b2b","b2c"] },
};

/* ---------------- mock data ---------------- */
const PRODUCTS = [
  { sku: "NS-EDP-001", name: "Nuit de Vétiver", type: "Eau de Parfum 50ml", cost: 420, retail: 2900, stock: 38 },
  { sku: "NS-CDL-014", name: "Fleur de Sel", type: "Scented Candle 220g", cost: 190, retail: 1250, stock: 12 },
  { sku: "NS-DFF-006", name: "Bois d'Encre", type: "Reed Diffuser 200ml", cost: 260, retail: 1650, stock: 5 },
  { sku: "NS-EDP-022", name: "Rose Absinthe", type: "Eau de Parfum 50ml", cost: 460, retail: 3200, stock: 27 },
];
const B2B = [
  { name: "Sathorn Grand Hotel", orders: 14, credit: "30 วัน", last: "02 ก.ค.", pending: 2 },
  { name: "Aurum Spa Group", orders: 9, credit: "45 วัน", last: "28 มิ.ย.", pending: 0 },
  { name: "Maison Living Co.", orders: 21, credit: "30 วัน", last: "05 ก.ค.", pending: 1 },
];
const SAMPLES = [
  { to: "Sathorn Grand Hotel", item: "Bois d'Encre ×3", sent: "01 ก.ค. 2568", track: "TH883021", status: "ตอบรับแล้ว" },
  { to: "The Peninsula Retail", item: "Nuit de Vétiver ×2", sent: "27 มิ.ย. 2568", track: "TH881640", status: "รอผล" },
];
const LOCATIONS = [
  { name: "หน้าร้าน ทองหล่อ", stock: 41, kind: "store" },
  { name: "คลังกลาง บางนา", stock: 320, kind: "warehouse" },
  { name: "ออนไลน์ (พร้อมขาย)", stock: 88, kind: "online" },
  { name: "ฝากขาย · Central Chidlom", stock: 16, kind: "consign", sold: 9, returned: 1 },
];
const SUPPLIERS = [
  { name: "Grasse Naturals (FR)", material: "หัวน้ำหอม / Absolutes", po: "PO-2025-041", contract: "31 ธ.ค. 2568", days: 175 },
  { name: "Siam Glassworks", material: "ขวดแก้ว / Flacon", po: "PO-2025-039", contract: "20 ก.ค. 2568", days: 11 },
  { name: "Lumière Wax Co.", material: "ไขเทียนถั่วเหลือง", po: "PO-2025-044", contract: "15 ก.ย. 2568", days: 68 },
];
const AUDIT = [
  { who: "เจ้าของ", act: "ดู Formula Lab · Nuit de Vétiver", when: "วันนี้ 09:14", tag: "secret" },
  { who: "ฝ่ายขาย", act: "สร้างใบเสนอราคา · Maison Living", when: "วันนี้ 08:52", tag: "edit" },
  { who: "ผู้จัดการ", act: "แก้สต็อก NS-DFF-006 (7→5)", when: "เมื่อวาน 17:30", tag: "edit" },
  { who: "ฝ่ายจัดซื้อ", act: "เปิด PO-2025-044", when: "เมื่อวาน 15:02", tag: "create" },
  { who: "ฝ่ายขาย", act: "เข้าดูหน้า B2C · สต็อก", when: "เมื่อวาน 11:20", tag: "view" },
];
const ALERTS = [
  { icon: AlertTriangle, title: "สัญญาใกล้หมดอายุ", body: "Siam Glassworks เหลือ 11 วัน", t: "1 ชม.", tone: "red" },
  { icon: Boxes, title: "สต็อกใกล้หมด", body: "Bois d'Encre เหลือ 5 ชิ้น", t: "3 ชม.", tone: "ink" },
  { icon: Truck, title: "ตัวอย่างถูกตอบรับ", body: "Sathorn Grand ตอบรับ Bois d'Encre", t: "วันนี้", tone: "green" },
];
const SALES6 = [180, 220, 195, 260, 240, 310];
const MONTHS = ["ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค."];

/* ---------------- helpers ---------------- */
const baht = (n) => "฿" + n.toLocaleString("th-TH");

function Secret({ show, children }: { show?: boolean; children?: any }) {
  if (show) return <>{children}</>;
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 align-middle"
      style={{ background: C.redSoft, color: C.red, fontFamily: sans, fontSize: 11, fontWeight: 600 }}>
      <Lock size={11} /> ลับ
    </span>
  );
}
function Pill({ children, bg, fg }: { children?: any; bg?: string; fg?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
      style={{ background: bg, color: fg, fontSize: 11, fontFamily: sans, fontWeight: 600 }}>{children}</span>
  );
}
function Line() {
  const max = Math.max(...SALES6), min = Math.min(...SALES6);
  const pts = SALES6.map((v, i) => {
    const x = (i / (SALES6.length - 1)) * 300;
    const y = 96 - ((v - min) / (max - min)) * 78 - 8;
    return [x, y];
  });
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = d + ` L300 104 L0 104 Z`;
  return (
    <svg viewBox="0 0 300 112" className="w-full" style={{ height: 120 }}>
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.brand} stopOpacity="0.14" />
          <stop offset="1" stopColor={C.brand} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#g)" />
      <path d={d} fill="none" stroke={C.brand} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => i === pts.length - 1 && (
        <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={C.brand} stroke="#fff" strokeWidth="2" />
      ))}
    </svg>
  );
}

/* ---------------- app ---------------- */
export default function App() {
  const auth = useAuth();
  const demo = !isSupabaseConfigured; // ไม่มีคีย์ Supabase = โหมดเดโม (ข้อมูลจำลอง)

  const [authedDemo, setAuthed] = useState(false);
  const [step, setStep] = useState("google");
  const [roleDemo, setRole] = useState("owner");
  // ใช้ sessionStorage: สลับแอป = session เดิม (อยู่หน้าเดิม) / ปัดปิดแอป = จบ session (เริ่ม Overview)
  const [screen, setScreen] = useState(() => {
    const s = sessionStorage.getItem("ns_screen");
    return s && !["connect", "portal", "audit", "users", "formula", "products"].includes(s) ? s : "modules";
  });
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => { sessionStorage.setItem("ns_screen", screen); }, [screen]);
  // ล้าง localStorage เก่าที่เคยใช้ (ย้ายมา sessionStorage แล้ว)
  useEffect(() => { ["b2c_channel", "b2c_shop", "b2c_sub", "ns_screen", "ns_left_at"].forEach((k) => localStorage.removeItem(k)); }, []);
  const [rolePick, setRolePick] = useState(false);

  // รหัสเข้า N SAVOIR CONNECT (ล็อกอีกชั้นสำหรับเจ้าของ)
  const CONNECT_PIN = (import.meta.env.VITE_CONNECT_PIN as string) || "2580";
  const [connectUnlocked, setConnectUnlocked] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState("");
  const openConnect = () => { if (connectUnlocked) go("connect"); else { setPinInput(""); setPinErr(""); setPinOpen(true); } };
  const submitPin = () => {
    if (pinInput === CONNECT_PIN) { setConnectUnlocked(true); setPinOpen(false); go("connect"); }
    else { setPinErr("รหัสไม่ถูกต้อง"); setPinInput(""); }
  };

  // role: โหมดเดโมใช้ตัวสลับ / โหมดจริงใช้ role จากฐานข้อมูล
  const role = demo ? roleDemo : (auth.profile?.role ?? "sales");
  const P = ROLES[role as keyof typeof ROLES] || ROLES.sales;

  // แถบดำด้านบน (theme-color/พื้นหลัง) เฉพาะหน้า Overview เท่านั้น หน้าอื่นเป็นสีอ่อน
  const darkTop = screen === "modules";
  useEffect(() => {
    const color = darkTop ? "#111214" : "#F1F2F4";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
    document.body.style.background = color;
  }, [darkTop]);
  const authed = demo ? authedDemo : Boolean(auth.session && auth.profile);
  // ตัวจัดการย้อนกลับของหน้าย่อย (ปิดฟอร์ม/มุมมองย่อยก่อนออกจากหน้า)
  const backHandlerRef = useRef<(() => void) | null>(null);
  const registerBack = (fn: (() => void) | null) => { backHandlerRef.current = fn; };

  // โซน Connect: เดินไปมาภายในไม่ต้องใส่รหัสซ้ำ — จะล็อกใหม่เมื่อ "ออกจากโซน" เท่านั้น
  const CONNECT_AREA = ["connect", "portal", "audit", "users", "formula", "products"];
  const go = (s) => {
    backHandlerRef.current = null;
    if (!CONNECT_AREA.includes(s)) setConnectUnlocked(false);
    setHistory((h) => (s === screen ? h : [...h, screen]));
    setScreen(s);
    window.scrollTo(0, 0);
  };
  // ปุ่มย้อนกลับ: ถ้าหน้าย่อยมีมุมมองเปิดอยู่ให้ปิดก่อน ไม่งั้นกลับหน้าก่อนหน้า
  const goBack = () => {
    if (backHandlerRef.current) { backHandlerRef.current(); return; }
    setHistory((h) => {
      const prev = h.length ? h[h.length - 1] : "modules";
      if (!CONNECT_AREA.includes(prev)) setConnectUnlocked(false);
      setScreen(prev);
      return h.slice(0, -1);
    });
    window.scrollTo(0, 0);
  };

  /* ---------- โครงหน้าล็อกอิน (โลโก้ + ชื่อแบรนด์) ---------- */
  const AuthShell = ({ children }: { children?: any }) => (
    <div style={{ fontFamily: sans, background: C.bg, minHeight: "100vh", color: C.ink }}
      className="flex flex-col items-center justify-center px-7 max-w-md mx-auto">
      <style>{FONTS}</style>
      <div className="w-full text-center">
        <div className="mx-auto mb-6 flex items-center justify-center rounded-2xl"
          style={{ width: 72, height: 72, background: C.ink, color: "#fff", boxShadow: SHADOW }}>
          <span style={{ fontFamily: disp, fontSize: 34, fontWeight: 800 }}>N</span>
        </div>
        <div style={{ fontFamily: disp, fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>HOUSE OF N SAVOIR</div>
        <div style={{ color: C.sub, fontSize: 11, letterSpacing: 3, marginTop: 6 }}>INTERNAL · CONFIDENTIAL</div>
        {children}
      </div>
    </div>
  );

  const GoogleBtn = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}
      className="w-full flex items-center justify-center gap-3 rounded-2xl py-4"
      style={{ background: C.card, color: C.ink, fontWeight: 600, boxShadow: SHADOW_SM }}>
      <span style={{ fontFamily: disp, fontWeight: 800, color: C.brand }}>G</span> เข้าสู่ระบบด้วย Google
    </button>
  );

  /* ---------- LOGIN (โหมดจริง — ต่อ Supabase) ---------- */
  if (!demo) {
    if (auth.loading) {
      return (
        <AuthShell>
          <div className="mt-10 flex justify-center" style={{ color: C.sub }}>
            <Loader2 size={24} className="animate-spin" />
          </div>
        </AuthShell>
      );
    }
    if (!auth.session) {
      return (
        <AuthShell>
          <div className="mt-10">
            <GoogleBtn onClick={() => auth.signInWithGoogle()} />
            <p style={{ color: C.sub, fontSize: 12 }} className="mt-4 leading-relaxed">
              เฉพาะอีเมลที่ได้รับเชิญ · เปิดใช้ยืนยันตัวตน 2 ชั้น
            </p>
          </div>
        </AuthShell>
      );
    }
    if (auth.notInvited || !auth.profile) {
      return (
        <AuthShell>
          <div className="mt-8">
            <div className="flex items-center justify-center gap-2" style={{ color: C.red }}>
              <Lock size={16} /><span style={{ fontSize: 14, fontWeight: 700 }}>ยังไม่ได้รับเชิญ</span>
            </div>
            <p style={{ color: C.sub, fontSize: 12 }} className="mt-3 leading-relaxed">
              อีเมล <b>{auth.session.user.email}</b> ยังไม่มีสิทธิ์เข้าใช้งาน<br />ติดต่อเจ้าของระบบเพื่อขอเชิญ
            </p>
            <button onClick={() => auth.signOut()}
              className="mt-7 w-full rounded-2xl py-4" style={{ background: C.ink, color: "#fff", fontWeight: 700 }}>
              ออกจากระบบ
            </button>
          </div>
        </AuthShell>
      );
    }
    // ล็อกอิน + ได้รับเชิญแล้ว แต่ยังไม่ผ่านยืนยัน 2 ชั้น → บังคับทำ 2FA ก่อน
    if (auth.aal.current !== "aal2") {
      return <MfaGate />;
    }
  }

  /* ---------- LOGIN (โหมดเดโม — ข้อมูลจำลอง) ---------- */
  if (demo && !authed) {
    return (
      <AuthShell>
        {step === "google" ? (
          <div className="mt-10">
            <GoogleBtn onClick={() => setStep("otp")} />
            <p style={{ color: C.sub, fontSize: 12 }} className="mt-4 leading-relaxed">
              โหมดเดโม · เฉพาะอีเมลที่ได้รับเชิญ · เปิดใช้ยืนยันตัวตน 2 ชั้น
            </p>
          </div>
        ) : (
          <div className="mt-10">
            <div className="flex items-center justify-center gap-2" style={{ color: C.brand }}>
              <Fingerprint size={18} /><span style={{ fontSize: 13, fontWeight: 600 }}>ยืนยันตัวตนขั้นที่ 2</span>
            </div>
            <div className="mt-4 flex justify-center gap-2">
              {[1,2,3,4,5,6].map((n) => (
                <div key={n} className="rounded-xl flex items-center justify-center"
                  style={{ width: 44, height: 54, background: C.card, boxShadow: SHADOW_SM, fontFamily: disp, fontSize: 20, fontWeight: 700, color: C.ink }}>
                  {n <= 2 ? "•" : ""}
                </div>
              ))}
            </div>
            <button onClick={() => setAuthed(true)}
              className="mt-7 w-full rounded-2xl py-4" style={{ background: C.brand, color: "#fff", fontWeight: 700 }}>
              ยืนยันรหัส OTP
            </button>
          </div>
        )}
      </AuthShell>
    );
  }

  /* ---------- shared UI ---------- */
  const Header = ({ title, back }: { title?: any; back?: boolean }) => (
    <div className="px-5 pt-4 pb-2 flex items-center justify-between">
      {back ? (
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="rounded-full flex items-center justify-center"
            style={{ width: 38, height: 38, background: C.card, boxShadow: SHADOW_SM }}>
            <ArrowLeft size={18} style={{ color: C.ink }} />
          </button>
          <span style={{ fontFamily: disp, fontSize: 20, fontWeight: 700, color: C.ink }}>{title}</span>
        </div>
      ) : (
        <div>
          <div style={{ color: C.sub, fontSize: 13 }}>สวัสดีตอนบ่าย</div>
          <div style={{ fontFamily: disp, fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: -0.3 }}>N SAVOIR</div>
        </div>
      )}
      <button onClick={() => (demo ? setRolePick(true) : go("me"))} className="flex items-center gap-2 rounded-full pl-2 pr-3 py-1.5"
        style={{ background: C.card, boxShadow: SHADOW_SM }}>
        <span className="rounded-full flex items-center justify-center"
          style={{ width: 26, height: 26, background: C.ink, color: "#fff", fontFamily: disp, fontWeight: 800, fontSize: 13 }}>N</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{P.name}</span>
        <ChevronDown size={13} style={{ color: C.sub }} />
      </button>
    </div>
  );

  const RolePicker = () => demo && rolePick && (
    <div className="fixed inset-0 z-40 flex items-end max-w-md mx-auto" style={{ background: "rgba(0,0,0,.4)" }}
      onClick={() => setRolePick(false)}>
      <div className="w-full rounded-t-3xl p-5" style={{ background: C.card }} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 rounded-full" style={{ width: 40, height: 4, background: C.line }} />
        <div className="flex items-center gap-2 mb-1" style={{ color: C.ink }}>
          <KeyRound size={16} style={{ color: C.brand }} /><span style={{ fontFamily: disp, fontSize: 17, fontWeight: 700 }}>สลับมุมมองสิทธิ์ (เดโม)</span>
        </div>
        <p style={{ color: C.sub, fontSize: 12 }} className="mb-4">
          สลับ role เพื่อดูว่าแต่ละคนเห็น/ทำอะไรได้ — ต้นทุน สูตร และการเงินจะถูกซ่อนตามสิทธิ์
        </p>
        {Object.entries(ROLES).map(([k, r]) => (
          <button key={k} onClick={() => { setRole(k); setRolePick(false); go("modules"); }}
            className="w-full flex items-center justify-between rounded-2xl px-4 py-3.5 mb-2"
            style={{ background: role === k ? C.ink : C.bg }}>
            <div className="text-left">
              <div style={{ color: role === k ? "#fff" : C.ink, fontWeight: 700, fontSize: 14 }}>{r.name}
                <span style={{ color: role === k ? "#9AA0A6" : C.sub, fontWeight: 400 }}> · {r.en}</span></div>
              <div style={{ color: role === k ? "#9AA0A6" : C.sub, fontSize: 11 }}>เข้าถึง {r.mods.length} หมวด {r.formula ? "· สูตรลับ" : ""} {r.finance ? "· การเงิน" : ""}</div>
            </div>
            {role === k && <Check size={18} style={{ color: C.brand }} />}
          </button>
        ))}
      </div>
    </div>
  );

  const Card = ({ children, onClick, style, pad = "p-4" }: { children?: any; onClick?: any; style?: any; pad?: string }) => (
    <div onClick={onClick} className={"rounded-3xl " + pad}
      style={{ background: C.card, boxShadow: SHADOW_SM, ...style }}>{children}</div>
  );
  const SectionTitle = ({ children, action }: { children?: any; action?: any }) => (
    <div className="px-1 mb-3 mt-6 flex items-center justify-between">
      <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>{children}</span>
      {action}
    </div>
  );

  const MODULES = [
    { id: "b2c", name: "B2C", icon: Store, sub: "สต็อก · ฝากขาย" },
    { id: "b2b", name: "B2B", icon: Handshake, sub: "ลูกค้า · ออเดอร์" },
    { id: "supplier", name: "Supplier", icon: Factory, sub: "PO · สัญญา" },
    { id: "office", name: "Office", icon: Building2, sub: "เอกสาร · สถิติ" },
  ];


  /* ---------- ป๊อปอัพใส่รหัสเข้า Connect ---------- */
  const PinModal = () => pinOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-8 max-w-md mx-auto" style={{ background: "rgba(0,0,0,.5)" }}
      onClick={() => setPinOpen(false)}>
      <div className="w-full rounded-3xl p-6 text-center" style={{ background: C.card }} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 flex items-center justify-center rounded-2xl" style={{ width: 52, height: 52, background: C.ink }}>
          <Lock size={22} style={{ color: C.brand }} />
        </div>
        <div style={{ fontFamily: disp, fontSize: 17, fontWeight: 700, color: C.ink }}>ใส่รหัสเข้า Connect</div>
        <div style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>เฉพาะเจ้าของเท่านั้น</div>
        <input value={pinInput} autoFocus type="password" inputMode="numeric"
          onChange={(e) => { setPinInput(e.target.value); setPinErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && submitPin()}
          placeholder="••••"
          className="w-full rounded-2xl py-4 text-center mt-5"
          style={{ background: C.bg, border: "none", outline: "none", fontFamily: disp, fontSize: 26, letterSpacing: 8, color: C.ink }} />
        {pinErr && <p style={{ color: C.red, fontSize: 12 }} className="mt-2">{pinErr}</p>}
        <button onClick={submitPin} className="w-full rounded-2xl py-4 mt-4" style={{ background: C.brand, color: "#fff", fontWeight: 700 }}>
          เข้าสู่ Connect
        </button>
      </div>
    </div>
  );

  /* ---------- N SAVOIR CONNECT = Formula Lab + Portal ---------- */
  const ConnectScreen = () => (
    <div className="px-5 pb-32">
      {/* Formula Lab — ดีไซน์เดิม (ล็อกถ้าไม่มีสิทธิ์) */}
      <div onClick={() => P.formula && go("formula")} className="rounded-3xl p-5 mt-2" style={{ background: C.ink }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2" style={{ color: "#fff" }}>
              <FlaskConical size={18} style={{ color: C.brand }} />
              <span style={{ fontFamily: disp, fontSize: 17, fontWeight: 700 }}>Formula Lab</span>
            </div>
            <div style={{ color: "#9AA0A6", fontSize: 12, marginTop: 6, maxWidth: 200 }}>
              สูตรผสมกลิ่น + คำนวณต้นทุน/ราคา · ลับสุดยอด
            </div>
            <div className="mt-4 inline-flex items-center gap-1 rounded-full px-3 py-1.5"
              style={{ background: P.formula ? C.brand : "#2A2B2E", color: "#fff", fontSize: 12, fontWeight: 600 }}>
              {P.formula ? <>เปิดดูสูตร <ChevronRight size={13} /></> : <><Lock size={12} /> เฉพาะเจ้าของ</>}
            </div>
          </div>
          <ShieldCheck size={40} style={{ color: "#2A2B2E" }} />
        </div>
      </div>

      {/* Main Stock (สินค้ากลาง) */}
      <div onClick={() => go("products")} className="rounded-3xl p-4 mt-3 flex items-center justify-between"
        style={{ background: C.card, boxShadow: SHADOW_SM }}>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl flex items-center justify-center" style={{ width: 44, height: 44 }}>
            <Package size={20} style={{ color: C.ink }} />
          </div>
          <div>
            <div style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: C.ink }}>Main Stock</div>
            <div style={{ fontSize: 11, color: C.sub }}>คลังสินค้ากลาง · คีย์ครั้งเดียว ใช้ทั้งระบบ</div>
          </div>
        </div>
        <ChevronRight size={18} style={{ color: C.sub }} />
      </div>

      {/* Portal — เฉพาะเจ้าของ/Dev */}
      {P.audit && (
        <div onClick={() => go("portal")} className="rounded-3xl p-4 mt-3 flex items-center justify-between"
          style={{ background: C.card, boxShadow: SHADOW_SM }}>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl flex items-center justify-center" style={{ width: 44, height: 44 }}>
              <SlidersHorizontal size={20} style={{ color: C.ink }} />
            </div>
            <div>
              <div style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: C.ink }}>Portal</div>
              <div style={{ fontSize: 11, color: C.sub }}>Audit Log · จัดการผู้ใช้งาน</div>
            </div>
          </div>
          <ChevronRight size={18} style={{ color: C.sub }} />
        </div>
      )}
    </div>
  );

  /* ---------- หน้า Connect ตอนล็อกอยู่ (ยังไม่ใส่รหัส) ---------- */
  const ConnectLocked = () => (
    <div className="px-5 flex flex-col items-center justify-center text-center" style={{ minHeight: "62vh" }}>
      <div className="rounded-2xl flex items-center justify-center mb-4" style={{ width: 60, height: 60, background: C.redSoft }}>
        <Lock size={28} style={{ color: C.red }} />
      </div>
      <div style={{ fontFamily: disp, fontSize: 18, fontWeight: 700, color: C.ink }}>ล็อกอยู่</div>
      <div style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>ต้องใส่รหัสเพื่อเข้า N Savoir Connect</div>
      <button onClick={openConnect} className="mt-6 rounded-2xl px-7 py-3.5" style={{ background: C.ink, color: "#fff", fontWeight: 700, fontSize: 14 }}>
        ใส่รหัส
      </button>
    </div>
  );

  /* ---------- Portal = Audit Log + จัดการผู้ใช้ (เจ้าของ/Dev) ---------- */
  const PortalScreen = () => (
    <div className="px-5 pb-32">
      {P.audit && (
        <div onClick={() => go("audit")} className="rounded-3xl p-4 mt-2 flex items-center justify-between"
          style={{ background: C.card, boxShadow: SHADOW_SM }}>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl flex items-center justify-center" style={{ width: 44, height: 44 }}>
              <ScrollText size={20} style={{ color: C.ink }} />
            </div>
            <div>
              <div style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: C.ink }}>Audit Log</div>
              <div style={{ fontSize: 11, color: C.sub }}>ใครทำอะไร เมื่อไหร่ · เก็บถาวร</div>
            </div>
          </div>
          <ChevronRight size={18} style={{ color: C.sub }} />
        </div>
      )}
      {(role === "owner" || role === "dev") && (
        <div onClick={() => go("users")} className="rounded-3xl p-4 mt-3 flex items-center justify-between"
          style={{ background: C.card, boxShadow: SHADOW_SM }}>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl flex items-center justify-center" style={{ width: 44, height: 44 }}>
              <User size={20} style={{ color: C.ink }} />
            </div>
            <div>
              <div style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: C.ink }}>กำหนดสิทธิ์ · จัดการผู้ใช้งาน</div>
              <div style={{ fontSize: 11, color: C.sub }}>เชิญ / เปลี่ยนตำแหน่ง / ปิดใช้งาน</div>
            </div>
          </div>
          <ChevronRight size={18} style={{ color: C.sub }} />
        </div>
      )}
    </div>
  );

  /* ---------- DASHBOARD (ภาพรวม) — ล้างไว้ก่อน เดี๋ยวปรับใหม่ ---------- */
  const HomeScreen = () => (
    <div className="px-5 pb-32">
      <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "60vh" }}>
        <div className="rounded-2xl flex items-center justify-center mb-4" style={{ width: 56, height: 56, background: C.card, boxShadow: SHADOW_SM }}>
          <LayoutGrid size={24} style={{ color: C.sub }} />
        </div>
        <div style={{ fontFamily: disp, fontSize: 18, fontWeight: 700, color: C.ink }}>Dashboard</div>
        <div style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>กำลังปรับปรุง · เดี๋ยวทำใหม่</div>
      </div>
    </div>
  );

  /* ---------- OFFICE ---------- */
  const Office = () => (
    <div className="px-5 pb-32">
      <Card style={{ marginTop: 8 }}>
        <div className="flex items-center justify-between">
          <div><div style={{ color: C.sub, fontSize: 12 }}>ยอดขายรวม 6 เดือน</div>
            <div style={{ fontFamily: disp, fontWeight: 800, fontSize: 24, color: C.ink }} className="mt-0.5">฿1.4M</div></div>
          <Pill bg={C.greenSoft} fg={C.green}><TrendingUp size={12} /> +12%</Pill>
        </div>
        <div className="mt-2"><Line /></div>
        <div className="flex justify-between px-1" style={{ fontFamily: mono, fontSize: 9, color: C.sub }}>
          {MONTHS.map((m) => <span key={m}>{m}</span>)}
        </div>
      </Card>
      <SectionTitle>ฐานลูกค้า (ชุดกลาง)</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Card><div style={{ fontFamily: disp, fontWeight: 800, fontSize: 26, color: C.ink }}>1,284</div>
          <div style={{ color: C.sub, fontSize: 11 }}>ลูกค้าทั้งหมด</div></Card>
        <Card><div style={{ fontFamily: disp, fontWeight: 800, fontSize: 26, color: C.green }}>+46</div>
          <div style={{ color: C.sub, fontSize: 11 }}>ใหม่เดือนนี้</div></Card>
      </div>
      <SectionTitle>เครื่องมือ</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Card><FileText size={19} style={{ color: C.ink }} /><div style={{ fontFamily: disp, fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 8 }}>สร้างใบเสนอราคา</div><div style={{ color: C.sub, fontSize: 11 }}>สร้าง + เก็บ + PDF</div></Card>
        <Card><TrendingUp size={19} style={{ color: C.green }} /><div style={{ fontFamily: disp, fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 8 }}>สถิติภาพรวม</div><div style={{ color: C.sub, fontSize: 11 }}>กราฟ + รายงาน</div></Card>
      </div>
      <SectionTitle>เอกสารภายใน</SectionTitle>
      {["นโยบายราคาส่ง 2568.pdf","แผนการตลาด Q3.xlsx","นำเข้าจาก Excel.csv"].map((f) => (
        <div key={f} className="flex items-center gap-3 rounded-2xl p-3.5 mb-2" style={{ background: C.card, boxShadow: SHADOW_SM }}>
          <div className="rounded-xl flex items-center justify-center" style={{ width: 36, height: 36, background: C.bg }}>
            <FileText size={17} style={{ color: C.ink }} /></div>
          <span style={{ color: C.ink, fontSize: 13, fontWeight: 500 }} className="flex-1">{f}</span>
          <ChevronRight size={16} style={{ color: C.sub }} />
        </div>
      ))}
    </div>
  );

  /* ---------- B2B ---------- */
  const B2BScreen = () => (
    <div className="px-5 pb-32">
      <SectionTitle>ลูกค้าค้าส่ง</SectionTitle>
      {B2B.map((c) => (
        <Card key={c.name} style={{ marginBottom: 10 }}>
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>{c.name}</span>
            {c.pending > 0 && <Pill bg={C.redSoft} fg={C.red}>ค้าง {c.pending}</Pill>}
          </div>
          <div className="flex gap-4 mt-2" style={{ fontSize: 12, color: C.sub }}>
            <span>ออเดอร์ {c.orders}</span><span>เครดิต {c.credit}</span><span>ล่าสุด {c.last}</span>
          </div>
        </Card>
      ))}
      <SectionTitle>เครื่องมือ</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Card><RotateCcw size={19} style={{ color: C.brand }} /><div style={{ fontFamily: disp, fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 8 }}>คืน / เคลม</div><div style={{ color: C.sub, fontSize: 11 }}>2 รายการเปิดอยู่</div></Card>
      </div>
      <SectionTitle>ตัวอย่างที่ส่งแล้ว · tracking</SectionTitle>
      {SAMPLES.map((s) => (
        <Card key={s.track} style={{ marginBottom: 10 }}>
          <div className="flex items-center justify-between">
            <span style={{ color: C.ink, fontWeight: 700, fontSize: 14 }}>{s.to}</span>
            <Pill bg={s.status === "ตอบรับแล้ว" ? C.greenSoft : C.bg} fg={s.status === "ตอบรับแล้ว" ? C.green : C.sub}>{s.status}</Pill>
          </div>
          <div style={{ color: C.sub, fontSize: 12 }} className="mt-1">{s.item}</div>
          <div className="flex items-center gap-3 mt-2" style={{ fontSize: 12, color: C.sub }}>
            <span className="flex items-center gap-1"><Truck size={13} /> {s.sent}</span>
            <span style={{ fontFamily: mono }}>{s.track}</span>
          </div>
        </Card>
      ))}
    </div>
  );

  /* ---------- B2C ---------- */
  const B2CScreen = () => (
    <div className="px-5 pb-32">
      <SectionTitle>สต็อกตามสถานที่</SectionTitle>
      {LOCATIONS.map((l) => (
        <Card key={l.name} style={{ marginBottom: 10 }}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2" style={{ color: C.ink, fontSize: 14, fontWeight: 600 }}>
              <MapPin size={15} style={{ color: C.brand }} /> {l.name}
            </span>
            <span style={{ fontFamily: disp, fontWeight: 800, fontSize: 20, color: C.ink }}>{l.stock}</span>
          </div>
          {l.kind === "consign" && (
            <div className="flex gap-4 mt-2 pt-2" style={{ fontSize: 12, color: C.sub, borderTop: `1px solid ${C.line}` }}>
              <span>ขายแล้ว {l.sold}</span><span>คืน {l.returned}</span><span style={{ color: C.green }}>ต้องเก็บเงิน {l.sold} ชิ้น</span>
            </div>
          )}
        </Card>
      ))}
      <SectionTitle>การตลาด</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Card><TrendingUp size={19} style={{ color: C.green }} /><div style={{ fontFamily: disp, fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 8 }}>แคมเปญ</div><div style={{ color: C.sub, fontSize: 11 }}>2 กำลังทำงาน</div></Card>
        <Card><Store size={19} style={{ color: C.ink }} /><div style={{ fontFamily: disp, fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 8 }}>ช่องทางขาย</div><div style={{ color: C.sub, fontSize: 11 }}>หน้าร้าน · ออนไลน์</div></Card>
      </div>
    </div>
  );

  /* ---------- SUPPLIER ---------- */
  const SupplierScreen = () => (
    <div className="px-5 pb-32">
      {SUPPLIERS.map((s) => (
        <Card key={s.name} style={{ marginTop: 10 }}>
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>{s.name}</span>
            <Pill bg={s.days <= 14 ? C.redSoft : C.greenSoft} fg={s.days <= 14 ? C.red : C.green}>
              <CalendarClock size={11} /> {s.days} วัน
            </Pill>
          </div>
          <div style={{ color: C.sub, fontSize: 12 }} className="mt-1">{s.material}</div>
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
            <span className="flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 12, color: C.ink }}><FileText size={13} /> {s.po}</span>
            <span style={{ fontSize: 12, color: C.sub }}>สัญญาถึง {s.contract}</span>
          </div>
        </Card>
      ))}
      <button className="w-full mt-4 rounded-2xl py-4 flex items-center justify-center gap-2"
        style={{ background: C.ink, color: "#fff", fontWeight: 700, fontSize: 14 }}>
        <Plus size={16} /> เปิดใบสั่งซื้อ (PO) ใหม่
      </button>
    </div>
  );

  /* ---------- PRODUCT MASTER ---------- */
  const Products = () => (
    <div className="px-5 pb-32">
      <p style={{ color: C.sub, fontSize: 12 }} className="mt-2 mb-3 px-1">คีย์ครั้งเดียว ใช้ทั้ง 4 หมวด</p>
      {PRODUCTS.map((p) => (
        <Card key={p.sku} style={{ marginBottom: 10 }}>
          <div className="flex items-center justify-between">
            <div>
              <div style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>{p.name}</div>
              <div style={{ color: C.sub, fontSize: 11 }}>{p.type}</div>
            </div>
            <span style={{ fontFamily: mono, fontSize: 11, color: C.sub }}>{p.sku}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
            <div>
              <div style={{ color: C.sub, fontSize: 10 }}>ต้นทุน</div>
              <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 14, color: C.ink, marginTop: 2 }}><Secret show={P.cost}>{baht(p.cost)}</Secret></div>
            </div>
            <div>
              <div style={{ color: C.sub, fontSize: 10 }}>ราคาขาย</div>
              <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 14, color: C.ink, marginTop: 2 }}>{baht(p.retail)}</div>
            </div>
            <div>
              <div style={{ color: C.sub, fontSize: 10 }}>คงเหลือ</div>
              <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 14, color: p.stock <= 12 ? C.red : C.ink, marginTop: 2 }}>{p.stock}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  /* ---------- FORMULA LAB ---------- */
  const Formula = () => (
    <div className="px-5 pb-32">
      <div className="rounded-3xl p-4 mt-2 flex items-center gap-3" style={{ background: C.ink }}>
        <ShieldCheck size={22} style={{ color: C.brand }} />
        <div>
          <div style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: "#fff" }}>พื้นที่ลับสุดยอด</div>
          <div style={{ fontSize: 11, color: "#9AA0A6" }}>ทุกการเข้าดูถูกบันทึกใน Audit Log</div>
        </div>
      </div>
      <SectionTitle>สูตรผสมกลิ่น · Nuit de Vétiver</SectionTitle>
      <Card>
        {[["Vetiver Haiti","18%"],["Bergamot Calabria","12%"],["Cedarwood Atlas","9%"],["Iso E Super","22%"],["Ambroxan","6%"],["Ethanol / base","33%"]].map(([n,v],i,a) => (
          <div key={n} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < a.length-1 ? `1px solid ${C.line}` : "none" }}>
            <span style={{ color: C.ink, fontSize: 13 }}>{n}</span>
            <span style={{ fontFamily: mono, fontSize: 13, color: C.brand, fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </Card>
      <SectionTitle>คำนวณต้นทุน → ราคา</SectionTitle>
      <Card>
        {[["ต้นทุนวัตถุดิบ/ขวด","฿420"],["บรรจุภัณฑ์","฿180"],["ต้นทุนรวม","฿600"],["ราคาขายแนะนำ (×4.8)","฿2,900"]].map(([n,v],i) => (
          <div key={n} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < 3 ? `1px solid ${C.line}` : "none" }}>
            <span style={{ color: C.ink, fontSize: 13, fontWeight: i === 3 ? 700 : 400 }}>{n}</span>
            <span style={{ fontFamily: disp, fontSize: 14, fontWeight: 700, color: i === 3 ? C.brand : C.ink }}>{v}</span>
          </div>
        ))}
      </Card>
    </div>
  );

  /* ---------- AUDIT ---------- */
  const Audit = () => (
    <div className="px-5 pb-32">
      <div className="flex items-center justify-between mt-2 mb-3 px-1">
        <p style={{ color: C.sub, fontSize: 13 }}>บันทึกทุกการเข้าดู/แก้ไข · เก็บถาวร</p>
        <Pill bg={C.ink} fg="#fff">Export</Pill>
      </div>
      {AUDIT.map((a, i) => {
        const map = { secret: [C.redSoft, C.red], edit: [C.bg, C.ink], create: [C.greenSoft, C.green], view: [C.bg, C.sub] };
        const [bg, fg] = map[a.tag];
        return (
          <div key={i} className="rounded-2xl p-3.5 mb-2 flex items-start gap-3" style={{ background: C.card, boxShadow: SHADOW_SM }}>
            <div className="rounded-xl flex items-center justify-center" style={{ width: 34, height: 34, background: bg, color: fg }}>
              {a.tag === "secret" ? <Lock size={15} /> : a.tag === "view" ? <Eye size={15} /> : <FileText size={15} />}
            </div>
            <div className="flex-1">
              <div style={{ color: C.ink, fontSize: 13, fontWeight: 500 }}>{a.act}</div>
              <div style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>{a.who} · {a.when}</div>
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ---------- ALERTS ---------- */
  const Alerts = () => (
    <div className="px-5 pb-32">
      <p style={{ color: C.sub, fontSize: 13 }} className="mt-2 mb-3 px-1">แจ้งเตือนในแอป · และ push แม้ปิดแอป (PWA)</p>
      {ALERTS.map((a, i) => {
        const tone = a.tone === "red" ? [C.redSoft, C.red] : a.tone === "green" ? [C.greenSoft, C.green] : [C.bg, C.ink];
        return (
          <div key={i} className="rounded-2xl p-4 mb-2 flex items-start gap-3" style={{ background: C.card, boxShadow: SHADOW_SM }}>
            <div className="rounded-xl flex items-center justify-center" style={{ width: 38, height: 38, background: tone[0], color: tone[1] }}>
              <a.icon size={18} />
            </div>
            <div className="flex-1">
              <div style={{ color: C.ink, fontSize: 14, fontWeight: 700 }}>{a.title}</div>
              <div style={{ color: C.sub, fontSize: 12 }}>{a.body}</div>
            </div>
            <span style={{ color: C.sub, fontSize: 10 }}>{a.t}</span>
          </div>
        );
      })}
    </div>
  );

  /* ---------- ME ---------- */
  const Me = () => (
    <div className="px-5 pb-32">
      <div className="flex items-center gap-3 mt-3">
        <div className="rounded-2xl flex items-center justify-center" style={{ width: 54, height: 54, background: C.ink, color: "#fff", fontFamily: disp, fontSize: 24, fontWeight: 800 }}>N</div>
        <div>
          <div style={{ fontFamily: disp, fontSize: 18, fontWeight: 700, color: C.ink }}>
            {demo ? "ผู้ใช้เดโม" : (auth.profile?.full_name || auth.session?.user.email || "ผู้ใช้")}
          </div>
          <div style={{ color: C.sub, fontSize: 12 }}>{P.name} · {P.en}</div>
        </div>
      </div>
      <SectionTitle>สิ่งที่ role นี้เข้าถึงได้</SectionTitle>
      {[
        ["หมวดงาน", `${P.mods.length}/4 หมวด`, true],
        ["ต้นทุนสินค้า", P.cost ? "เห็นได้" : "ซ่อน", P.cost],
        ["ตัวเลขการเงิน", P.finance ? "เห็นได้" : "ซ่อน", P.finance],
        ["สูตรกลิ่น (Formula Lab)", P.formula ? "เข้าได้" : "ล็อก", P.formula],
        ["Audit Log", P.audit ? "ดู/export ได้" : "ไม่ได้", P.audit],
      ].map(([k, v, ok]) => (
        <div key={String(k)} className="flex items-center justify-between rounded-2xl px-4 py-3.5 mb-2" style={{ background: C.card, boxShadow: SHADOW_SM }}>
          <span style={{ color: C.ink, fontSize: 13, fontWeight: 500 }}>{k}</span>
          <span style={{ color: ok ? C.green : C.red, fontSize: 12, fontWeight: 700 }}>{v}</span>
        </div>
      ))}
      {demo ? (
        <button onClick={() => setRolePick(true)} className="w-full mt-3 rounded-2xl py-4" style={{ background: C.ink, color: "#fff", fontWeight: 700, fontSize: 14 }}>
          สลับ role เพื่อทดสอบสิทธิ์
        </button>
      ) : (
        <button onClick={() => auth.signOut()} className="w-full mt-3 rounded-2xl py-4 flex items-center justify-center gap-2" style={{ background: C.ink, color: "#fff", fontWeight: 700, fontSize: 14 }}>
          <LogOut size={16} /> ออกจากระบบ
        </button>
      )}
    </div>
  );

  /* ---------- router ---------- */
  const titleMap = { office:"Office", b2b:"B2B · ค้าส่ง", b2c:"B2C · ค้าปลีก", supplier:"Supplier", products:"Main Stock", connect:"N SAVOIR CONNECT", portal:"Portal", formula:"Formula Lab", audit:"Audit Log", alerts:"แจ้งเตือน", me:"บัญชีของฉัน", users:"จัดการผู้ใช้", import:"นำเข้า Excel/CSV" };
  const NAV = [
    { id: "modules", label: "Overview", icon: Home },
    { id: "home", label: "Dashboard", icon: LayoutGrid },
    { id: "alerts", label: "แจ้งเตือน", icon: Bell },
    { id: "me", label: "Manage", icon: Settings },
  ];
  const isNavScreen = NAV.some((n) => n.id === screen);
  const Body = () => {
    switch (screen) {
      case "modules": return (
        <Overview
          brand="House of N Savoir"
          displayName={demo ? "ผู้ใช้เดโม" : (auth.profile?.full_name || auth.session?.user?.email || "ผู้ใช้")}
          email={demo ? "demo@nsavoir.app" : (auth.session?.user?.email || "")}
          roleName={P.name}
          isAdmin={role === "owner" || role === "dev"}
          modules={MODULES.filter((m) => P.mods.includes(m.id))}
          onModule={go}
          onDashboard={() => go("home")}
          onConnect={openConnect}
        />
      );
      case "home": return demo ? <HomeScreen /> : <DashboardReal finance={P.finance} />;
      case "office": return demo ? <Office /> : <OfficeReal go={go} finance={P.finance} />;
      case "b2b": return demo ? <B2BScreen /> : <B2BReal />;
      case "b2c": return demo ? <B2CScreen /> : <B2CReal />;
      case "supplier": return demo ? <SupplierScreen /> : <SupplierReal />;
      case "products": return demo ? <Products /> : <ProductsScreen />;
      case "connect": return connectUnlocked ? <ConnectScreen /> : <ConnectLocked />;
      case "portal": return <PortalScreen />;
      case "formula": return demo ? <Formula /> : <FormulaLabReal />;
      case "audit": return demo ? <Audit /> : <AuditScreen />;
      case "alerts": return demo ? <Alerts /> : <AlertsReal />;
      case "me": return <Me />;
      case "users": return <UsersAdmin />;
      case "import": return <ImportScreen />;
      default: return demo ? <HomeScreen /> : <DashboardReal finance={P.finance} />;
    }
  };

  return (
    <div style={{ fontFamily: sans, background: C.bg, minHeight: "100vh" }} className="max-w-md mx-auto relative">
      <style>{FONTS}</style>
      {/* หน้าแรก (หมวดงาน) ไม่มีหัวข้อและไม่มีแถบเมนู */}
      {screen !== "modules" && <Header title={titleMap[screen] || "N SAVOIR"} back={screen !== "home" && !isNavScreen} />}
      <NavCtx.Provider value={{ registerBack }}>
        <Body />
      </NavCtx.Provider>
      <RolePicker />
      <PinModal />

      {/* floating dark pill nav — ซ่อนบนหน้าแรก */}
      {screen !== "modules" && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-6 pb-4 pt-2 flex justify-center pointer-events-none">
          <div className="flex items-center gap-1 rounded-full px-2 py-2 pointer-events-auto"
            style={{ background: C.ink, boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>
            {NAV.map((n) => {
              const active = screen === n.id;
              return (
                <button key={n.id} onClick={() => go(n.id)}
                  className="flex items-center gap-2 rounded-full transition-all"
                  style={{ background: active ? C.brand : "transparent", padding: active ? "10px 16px" : "10px 12px" }}>
                  <n.icon size={20} style={{ color: active ? "#fff" : "#9AA0A6" }} />
                  {active && <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{n.label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
