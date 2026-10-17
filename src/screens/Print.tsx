import { useEffect, useState, useCallback, useMemo, useRef, useId } from "react";
import { Plus, Loader2, Tags, ChevronRight, Printer, ScanLine, Search, X, Check, CheckSquare } from "lucide-react";
import { toSVG } from "bwip-js/browser";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, mono, inputStyle } from "../lib/ui";
import { toast } from "../lib/toast";
import { Field } from "./B2B";
import { Modal, DeleteButton } from "@/components/ui/modal";
import FoLabels from "./FoLabels";
import { Button } from "@/components/ui/button";

/* ---------------- ชนิดข้อมูล ---------------- */
export type BatchLabel = {
  id: string; title: string; product_id: string | null; code: string | null;
  batch_no: string; mfg_date: string; exp_date: string; quantity: string;
  customer_id: string | null; customer_name: string | null; note: string | null;
  width_mm: number; height_mm: number;
  show_dm?: boolean; show_logo?: boolean;
  created_at: string;
};

/** ขนาดสติกเกอร์แนะนำของ Batch Label */
export const BATCH_W = 80;
export const BATCH_H = 50;
type Customer = { id: string; name: string };
type Product = { id: string; name: string; sku: string };

/* ---------------- ตัวช่วย ---------------- */
/** แปลงเป็น YYYY-MM-DD ตามเวลาบ้านเรา
 *  (ห้ามใช้ toISOString เพราะมันแปลงเป็นเวลาสากล ทำให้วันที่เลื่อนถอยไป 1 วัน) */
const ymd = (t: Date) =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;

const today = () => ymd(new Date());

/** วันหมดอายุ = วันผลิต + 2 ปี วันที่เดียวกันเป๊ะ (เติมให้อัตโนมัติ) */
export function plusTwoYears(d: string) {
  if (!d) return "";
  const t = new Date(d + "T00:00:00");
  if (isNaN(t.getTime())) return "";
  t.setFullYear(t.getFullYear() + 2);
  return ymd(t);
}
/** วันที่บนสติกเกอร์ แบบ 19.08.2026 */
const labelDate = (d: string) => {
  if (!d) return "-";
  const t = new Date(d + "T00:00:00");
  if (isNaN(t.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getDate())}.${p(t.getMonth() + 1)}.${t.getFullYear()}`;
};
const thaiDate = (d: string) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-";

/** ข้อความที่อยู่ใน Data Matrix = CODE กับ BATCH NO
 *  (ไม่ใส่ชื่อลูกค้า คนนอกยิงแล้วจึงไม่เห็นว่าส่งให้ใคร) */
export function dmPayload(code: string | null | undefined, batchNo: string) {
  const c = (code || "").trim();
  const b = (batchNo || "").trim();
  return c ? `${c}|${b}` : b;
}

export function dataMatrixSVG(text: string, scale = 4): string {
  if (!text) return "";
  try {
    return toSVG({ bcid: "datamatrix", text, scale, padding: 0 });
  } catch {
    return "";
  }
}
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------------------------------------
   หน้าตาสติกเกอร์ — ใช้ชุดเดียวกันทั้งตอนดูตัวอย่างและตอนปริ้น
   ทุกขนาดอ้างอิงตัวแปร --u (1 หน่วย = 1mm ตอนปริ้น)
   เปลี่ยนขนาดสติกเกอร์แล้วทุกอย่างย่อ/ขยายตามเองอัตโนมัติ
   ------------------------------------------------------------ */
export function labelCSS(w: number, h: number, scope = "") {
  // scope = คลาสเฉพาะของสติกเกอร์ใบนั้น กันสไตล์ทับกันเวลามีหลายใบในหน้าเดียว
  const S = scope ? `.${scope}` : "";
  // ขอบในคิดจากด้านที่สั้นกว่า ไม่ผูกกับการย่อ/ขยายตัวหนังสือ
  const pad = +(Math.min(w, h) * 0.075).toFixed(3);
  // --s = ตัวคูณขนาดตัวหนังสือ ค่าตั้งต้นเผื่อไว้กรณี JS ยังไม่ทำงาน
  // ของจริง fitLabel() จะวัดแล้วขยายให้เต็มพื้นที่ที่มี
  const start = +Math.min(w / BATCH_W, h / BATCH_H).toFixed(3);
  const b = (base: number) => `calc(var(--u) * var(--s) * ${base})`; // base = ขนาด mm ที่ 80x50
  const r = (n: number) => +n.toFixed(3);
  return `
  ${S}.label{
    --s:${start};
    width:calc(var(--u) * ${r(w)}); height:calc(var(--u) * ${r(h)});
    padding:calc(var(--u) * ${pad});
    border:calc(var(--u) * ${r(Math.max(0.18, pad * 0.12))}) solid #111;
    background:#fff; color:#111214; overflow:hidden;
    font-family:'Urbanist','Noto Sans Thai',Arial,sans-serif;
    line-height:1.02;
  }
  /* วางเป็น 2 คอลัมน์: ซ้าย = ข้อความ, ขวา = Data Matrix
     แบบนี้บาร์โค้ดไม่ไปกินความสูง ตัวหนังสือจึงขยายได้เต็มที่ */
  ${S} .l-fit{ display:flex; align-items:stretch; gap:${b(2)}; min-height:100%; }
  ${S} .l-main{ flex:1; min-width:0; display:flex; flex-direction:column; justify-content:space-between }
  ${S} .l-title{
    font-weight:800; font-size:${b(4.6)};
    line-height:1.05; word-break:break-word;
  }
  ${S} .l-code{ font-weight:500; font-size:${b(2.7)}; margin-top:${b(0.9)} }
  ${S} .l-code b{ font-weight:500; margin-left:${b(2.5)} }
  ${S} .l-rows{
    display:grid; grid-template-columns:auto auto 1fr;
    column-gap:${b(2.2)}; row-gap:${b(0.9)};
    font-size:${b(2.7)}; font-weight:500; margin-top:${b(2.6)};
  }
  ${S} .l-foot{ display:flex; align-items:flex-end; margin-top:${b(2)} }
  ${S} .l-brand{ display:flex; align-items:center; gap:${b(1.75)} }
  ${S} .l-brand img{ height:${b(3.6)}; width:auto; display:block }
  ${S} .l-brand span{ font-weight:800; font-size:${b(1.8)}; letter-spacing:${b(0.2)} }
  ${S} .l-dm{ width:${b(11.5)}; height:${b(11.5)}; flex:none; align-self:flex-end }
  ${S} .l-dm svg{ width:100%; height:100%; display:block; shape-rendering:crispEdges }
  `;
}

/** โค้ดวัด-แล้วขยาย: ทำให้ตัวหนังสือใหญ่ที่สุดเท่าที่ยังอยู่ในกรอบพอดี
 *  (เขียนเป็นข้อความเพื่อเอาไปแปะในหน้าต่างปริ้นได้ด้วย) */
export const FIT_FN = `
function fitLabel(el) {
  var fit = el.querySelector('.l-fit');
  if (!fit) return;
  var cur = function () {
    return parseFloat(el.style.getPropertyValue('--s')) ||
           parseFloat(getComputedStyle(el).getPropertyValue('--s')) || 1;
  };
  // ล้นด้านกว้างไหม — เช็คเฉพาะตัวที่หดไม่ได้ (ตารางข้อมูล/โลโก้)
  var tooWide = function () {
    var ns = fit.querySelectorAll('.l-rows, .l-brand, .l-code');
    for (var i = 0; i < ns.length; i++) {
      if (ns[i].scrollWidth > ns[i].clientWidth + 1) return true;
    }
    return false;
  };
  fit.style.minHeight = '0';
  // 1) ขยาย/ย่อให้ความสูงพอดีกรอบ
  for (var i = 0; i < 6; i++) {
    var cs = getComputedStyle(el);
    var availH = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var hh = fit.scrollHeight;
    if (!hh || availH <= 0) break;
    var c = cur();
    var next = Math.max(0.1, Math.min(6, c * (availH / hh) * 0.97));
    if (Math.abs(next - c) / c < 0.005) break;
    el.style.setProperty('--s', String(next));
  }
  // 2) ถ้าล้นด้านกว้าง ค่อยหดลงทีละนิดจนพอดี
  for (var j = 0; j < 14 && tooWide(); j++) {
    el.style.setProperty('--s', String(cur() * 0.94));
  }
  fit.style.minHeight = '';
}`;

/** เนื้อหาในสติกเกอร์ (HTML ชุดเดียว ใช้ทั้งดูตัวอย่างและปริ้น) */
export function labelInnerHTML(item: BatchLabel, logoUrl: string, dmScale = 6) {
  const withDM = item.show_dm !== false;
  const withLogo = item.show_logo !== false;
  const svg = withDM ? dataMatrixSVG(dmPayload(item.code, item.batch_no), dmScale) : "";
  const row = (k: string, v: string) => `<div>${k}</div><div>:</div><div>${esc(v)}</div>`;
  return `<div class="l-fit">
  <div class="l-main">
    <div>
      <div class="l-title">${esc(item.title)}</div>
      ${item.code ? `<div class="l-code">CODE :<b>${esc(item.code)}</b></div>` : ""}
      <div class="l-rows">
        ${row("BATCH NO.", item.batch_no)}
        ${row("MFG. DATE", labelDate(item.mfg_date))}
        ${row("EXP. DATE", labelDate(item.exp_date))}
        ${row("QUANTITY", String(item.quantity ?? ""))}
      </div>
    </div>
    ${withLogo ? `<div class="l-foot">
      <div class="l-brand"><img src="${logoUrl}" alt=""><span>HOUSE OF N SAVOIR</span></div>
    </div>` : ""}
  </div>
  ${withDM ? `<div class="l-dm">${svg}</div>` : ""}
</div>`;
}

/* ============================================================
   หน้า Print — รวมงานปริ้นทั้งหมด
   ============================================================ */
export default function PrintScreen() {
  const [open, setOpen] = useState<null | "batch" | "fo">(null);
  useEffect(() => { logAudit({ action: "view", entity: "screen", entityId: "print" }); }, []);
  useBackHandler(open !== null, () => setOpen(null));

  if (open === "batch") return <BatchLabels onBack={() => setOpen(null)} />;
  if (open === "fo") return <FoLabels onBack={() => setOpen(null)} />;

  const Card = ({ id, title, sub }: { id: "batch" | "fo"; title: string; sub: string }) => (
    <button onClick={() => setOpen(id)}
      className="mb-2.5 flex w-full items-center justify-between rounded-3xl bg-card p-4 text-left shadow-sm">
      <div className="flex items-center gap-3">
        <Tags size={26} strokeWidth={1.8} className="shrink-0 text-foreground" />
        <div>
          <div className="font-disp text-[15px] font-bold text-foreground">{title}</div>
          <div className="text-[11px] text-muted-foreground">{sub}</div>
        </div>
      </div>
      <ChevronRight size={18} className="text-muted-foreground" />
    </button>
  );

  return (
    <div className="px-5 pb-32">
      <p className="mb-3 mt-2 px-1 text-xs text-muted-foreground">งานที่พร้อมสั่งปริ้นได้ทันที</p>
      <Card id="batch" title="Batch Label" sub="สติกเกอร์ติดส่งลูกค้า 80×50mm · มี Data Matrix" />
      <Card id="fo" title="FO Label" sub="ฉลากสารเคมี 152.4×101.6mm · มีสัญลักษณ์อันตราย" />
    </div>
  );
}

/* ============================================================
   Batch Label — รายการทั้งหมด + เพิ่ม/แก้ไข/ลบ + สแกนค้นหา
   ============================================================ */
type ModalState = { k: "form"; item: BatchLabel | null } | { k: "view"; item: BatchLabel } | { k: "scan" } | null;

function BatchLabels({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<BatchLabel[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  // โหมดเลือกหลายรายการ: id -> จำนวนดวง
  const [pick, setPick] = useState(false);
  const [sel, setSel] = useState<Map<string, number>>(new Map());
  const [multiBusy, setMultiBusy] = useState<null | "a4" | "label">(null);
  const [multiErr, setMultiErr] = useState("");

  const sizeOf = (r: BatchLabel) =>
    `${Number(r.width_mm) || BATCH_W}×${Number(r.height_mm) || BATCH_H}mm`;
  /** ขนาดของใบแรกที่เลือก — ใบอื่นต้องขนาดนี้เท่านั้น */
  const lockSize = useMemo(() => {
    const first = rows.find((r) => sel.has(r.id));
    return first ? sizeOf(first) : null;
  }, [rows, sel]);
  const totalCopies = useMemo(() => [...sel.values()].reduce((a, b) => a + b, 0), [sel]);
  const sheets = useMemo(() => {
    const first = rows.find((r) => sel.has(r.id));
    if (!first) return 0;
    const per = Math.max(1, Math.floor(200 / (Number(first.width_mm) || BATCH_W))) *
                Math.max(1, Math.floor(287 / (Number(first.height_mm) || BATCH_H)));
    return Math.ceil(totalCopies / per);
  }, [rows, sel, totalCopies]);

  const toggleSel = (r: BatchLabel) => setSel((m) => {
    const n = new Map(m);
    if (n.has(r.id)) n.delete(r.id); else n.set(r.id, 1);
    return n;
  });
  const setCopiesFor = (id: string, v: string) => setSel((m) => {
    const n = new Map(m);
    const num = Math.min(999, Number(v.replace(/\D/g, "")) || 0);
    n.set(id, num);
    return n;
  });

  async function makeMultiPdf(mode: "a4" | "label") {
    const jobs = rows.filter((r) => (sel.get(r.id) ?? 0) > 0).map((r) => ({ item: r, copies: sel.get(r.id)! }));
    if (!jobs.length) { setMultiErr("ใส่จำนวนดวงอย่างน้อย 1 รายการ"); return; }
    setMultiErr(""); setMultiBusy(mode);
    try {
      const { openLabelsPdf } = await import("./labelPdf");
      await openLabelsPdf(jobs, mode);
      await logAudit({ action: "view", entity: "batch-label-print", entityId: `รวม ${jobs.length} รายการ`, newValue: { copies: totalCopies, mode } });
      toast.success("สร้างไฟล์ PDF แล้ว");
      setPick(false); setSel(new Map());
    } catch (e) {
      setMultiErr("สร้างไฟล์ไม่สำเร็จ — ลองใหม่อีกครั้ง");
      console.error(e);
    }
    setMultiBusy(null);
  }

  const load = useCallback(async () => {
    const [l, c, p] = await Promise.all([
      supabase.from("batch_labels")
        .select("id,title,product_id,code,batch_no,mfg_date,exp_date,quantity,customer_id,customer_name,note,width_mm,height_mm,show_dm,show_logo,created_at")
        .order("created_at", { ascending: false }).limit(300),
      supabase.from("customers").select("id,name").order("name"),
      supabase.from("products_view").select("id,name,sku").order("name"),
    ]);
    setRows((l.data as BatchLabel[]) || []);
    setCustomers((c.data as Customer[]) || []);
    setProducts((p.data as Product[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useBackHandler(true, () => { if (modal) setModal(null); else onBack(); });

  async function del(it: BatchLabel) {
    if (!confirm(`ลบสติกเกอร์ batch ${it.batch_no}?`)) return;
    const { error } = await supabase.from("batch_labels").delete().eq("id", it.id);
    if (error) { toast.error("ลบไม่สำเร็จ"); return; }
    await logAudit({ action: "delete", entity: "batch-label", entityId: it.batch_no, oldValue: it });
    toast.success("ลบแล้ว");
    setModal(null); load();
  }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.batch_no.toLowerCase().includes(s) || r.title.toLowerCase().includes(s) ||
      (r.code || "").toLowerCase().includes(s) || (r.customer_name || "").toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div className="px-5 pb-32">
      {/* ไม่ใส่ปุ่มย้อนกลับตรงนี้ — ใช้ปุ่มย้อนกลับบนหัวแอปอันเดียว ไม่งั้นมีสองปุ่มซ้ำกัน */}
      <div className="mb-3 mt-2 flex items-center justify-between">
        <div>
          <div className="font-disp text-xl font-extrabold text-foreground">Batch Label</div>
          <div className="text-[11px] text-muted-foreground">{rows.length} ใบที่เคยสร้าง</div>
        </div>
      </div>

      {/* ค้นหา + สแกน */}
      <div className="mb-3 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm">
          <Search size={16} className="shrink-0 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา batch / ชื่อ / ลูกค้า"
            className="w-full bg-transparent text-[13px] outline-none" style={{ color: C.ink }} />
          {q && <button onClick={() => setQ("")} aria-label="ล้าง"><X size={14} className="text-muted-foreground" /></button>}
        </div>
        <button onClick={() => setModal({ k: "scan" })} aria-label="สแกน Data Matrix"
          className="flex w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
          <ScanLine size={20} />
        </button>
      </div>

      {pick ? (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm">
          <div className="min-w-0 flex-1 text-[12.5px] leading-snug">
            {sel.size === 0
              ? <span className="text-muted-foreground">ติ๊กเลือกสติกเกอร์ที่จะปริ้น</span>
              : <>เลือก <b className="text-foreground">{sel.size} รายการ</b> · รวม <b className="text-foreground">{totalCopies} ดวง</b>
                  <span className="text-muted-foreground"> · ขนาด {lockSize}</span></>}
          </div>
          <button onClick={() => { setPick(false); setSel(new Map()); }}
            className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-semibold text-muted-foreground">
            ยกเลิก
          </button>
        </div>
      ) : (
        <div className="mb-4 flex gap-2">
          <button onClick={() => setModal({ k: "form", item: null })}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white"
            style={{ background: C.brand }}>
            <Plus size={16} /> สร้างสติกเกอร์ใหม่
          </button>
          {rows.length > 1 && (
            <button onClick={() => setPick(true)}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-ink px-4 text-[12.5px] font-bold text-white">
              <CheckSquare size={15} /> เลือกหลายรายการ
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          {rows.length === 0 ? "ยังไม่มีสติกเกอร์ — กด สร้างสติกเกอร์ใหม่" : "ไม่พบรายการที่ค้นหา"}
        </p>
      ) : (
        shown.map((r) => {
          const on = sel.has(r.id);
          // โหมดเลือกหลายรายการ: เลือกได้เฉพาะขนาดเดียวกันเท่านั้น (วางเรียงบนแผ่นเดียวกันได้)
          const blocked = pick && !on && lockSize !== null && sizeOf(r) !== lockSize;
          return (
            <div key={r.id}
              className="mb-2.5 flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm"
              style={{
                opacity: blocked ? 0.4 : 1,
                border: on ? `1.5px solid ${C.brand}` : "1.5px solid transparent",
              }}>
              {pick && (
                <button onClick={() => !blocked && toggleSel(r)} disabled={blocked} aria-label="เลือก"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2"
                  style={on ? { background: C.brand, borderColor: C.brand } : { borderColor: "#C9CDD3" }}>
                  {on && <Check size={14} strokeWidth={3} className="text-white" />}
                </button>
              )}
              <button onClick={() => (pick ? !blocked && toggleSel(r) : setModal({ k: "view", item: r }))}
                disabled={blocked} className="min-w-0 flex-1 text-left">
                <div className="truncate font-disp text-[15px] font-extrabold text-foreground">{r.title}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground" style={{ fontFamily: mono }}>
                  BATCH {r.batch_no}{r.code ? ` · ${r.code}` : ""}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-muted-foreground">
                  <span>ผลิต {thaiDate(r.mfg_date)}</span>
                  <span>หมดอายุ {thaiDate(r.exp_date)}</span>
                  <span>{sizeOf(r)}</span>
                </div>
                {blocked && <div className="mt-1 text-[10.5px] font-semibold text-destructive">ขนาดไม่ตรงกับที่เลือกไว้</div>}
                {r.customer_name && !blocked && <div className="mt-0.5 truncate text-[10.5px] font-semibold text-primary">{r.customer_name}</div>}
              </button>

              {pick ? (
                on && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <input
                      value={String(sel.get(r.id) ?? 1)}
                      onChange={(e) => setCopiesFor(r.id, e.target.value)}
                      inputMode="numeric"
                      aria-label="จำนวนดวง"
                      className="w-14 rounded-xl py-2 text-center text-[14px] font-bold"
                      style={inputStyle}
                    />
                    <span className="text-[10.5px] text-muted-foreground">ดวง</span>
                  </div>
                )
              ) : (
                <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
              )}
            </div>
          );
        })
      )}

      {/* แถบล่าง: สร้าง PDF จากรายการที่เลือก */}
      {pick && sel.size > 0 && (
        <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-5 pb-5 pt-3"
          style={{ background: "linear-gradient(to top, rgba(241,242,244,1) 55%, rgba(241,242,244,0))" }}>
          {multiErr && <p className="mb-2 text-center text-xs text-destructive">{multiErr}</p>}
          <button onClick={() => makeMultiPdf("a4")} disabled={multiBusy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white"
            style={{ background: C.brand, opacity: multiBusy ? 0.6 : 1 }}>
            {multiBusy === "a4"
              ? <><Loader2 size={16} className="animate-spin" /> กำลังสร้างไฟล์…</>
              : <><Printer size={16} /> PDF รวม {totalCopies} ดวง ({sheets} แผ่น A4)</>}
          </button>
          <button onClick={() => makeMultiPdf("label")} disabled={multiBusy !== null}
            className="mt-2 w-full rounded-2xl bg-card py-3 text-[12.5px] font-bold text-foreground shadow-sm">
            {multiBusy === "label" ? "กำลังสร้างไฟล์…" : `PDF เครื่องพิมพ์สติกเกอร์ (${lockSize})`}
          </button>
        </div>
      )}

      {/* ดูสติกเกอร์ + ปริ้น */}
      <Modal open={modal?.k === "view"} onClose={() => setModal(null)} title="สติกเกอร์ Batch Label">
        {modal?.k === "view" && (
          <LabelPreview
            item={modal.item}
            onEdit={() => setModal({ k: "form", item: modal.item })}
            onDelete={() => del(modal.item)}
          />
        )}
      </Modal>

      {/* เพิ่ม / แก้ไข */}
      <Modal open={modal?.k === "form"} onClose={() => setModal(null)}
        title={modal?.k === "form" && modal.item ? "แก้ไขสติกเกอร์" : "สร้างสติกเกอร์ใหม่"}>
        {modal?.k === "form" && (
          <LabelForm initial={modal.item} customers={customers} products={products}
            onDone={() => { setModal(null); load(); }}
            onDelete={modal.item ? () => del(modal.item!) : undefined} />
        )}
      </Modal>

      {/* สแกน Data Matrix เพื่อค้นหา */}
      <Modal open={modal?.k === "scan"} onClose={() => setModal(null)} title="สแกน Data Matrix">
        {modal?.k === "scan" && (
          <ScanLookup rows={rows} onOpen={(it) => setModal({ k: "view", item: it })} />
        )}
      </Modal>
    </div>
  );
}

/* ============================================================
   ช่องสแกน — ยิงด้วยเครื่องสแกน แล้วเด้งข้อมูลเต็มขึ้นมา
   (เครื่องสแกนทำงานเหมือนคีย์บอร์ด: พิมพ์เลข batch แล้วกด Enter)
   ============================================================ */
function ScanLookup({ rows, onOpen }: { rows: BatchLabel[]; onOpen: (it: BatchLabel) => void }) {
  const [code, setCode] = useState("");
  const [searched, setSearched] = useState(false);

  const hits = useMemo(() => {
    const s = code.trim().toLowerCase();
    if (!s) return [];
    // รองรับทั้งที่ยิงมาเต็ม ๆ "CODE|BATCH" และที่พิมพ์แค่เลข batch หรือแค่ code
    const [a, bpart] = s.includes("|") ? s.split("|").map((x) => x.trim()) : [s, ""];
    return rows.filter((r) => {
      const rc = (r.code || "").toLowerCase();
      const rb = r.batch_no.toLowerCase();
      if (bpart) return rc === a && rb === bpart;
      return rb === a || rc === a;
    });
  }, [rows, code]);

  return (
    <div className="pb-4">
      <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
        เอาเครื่องสแกนยิงที่ Data Matrix บนสติกเกอร์ได้เลย (หรือพิมพ์เลข BATCH NO เองก็ได้)
      </p>
      <input
        autoFocus
        value={code}
        onChange={(e) => { setCode(e.target.value); setSearched(true); }}
        onKeyDown={(e) => { if (e.key === "Enter") setSearched(true); }}
        placeholder="ยิงสแกนตรงนี้…"
        className="w-full rounded-2xl px-4 py-4 text-center"
        style={{ ...inputStyle, fontFamily: mono, fontSize: 18, letterSpacing: 1 }}
      />
      <div className="mt-4">
        {!code.trim() ? (
          <p className="py-6 text-center text-[12.5px] text-muted-foreground">รอรับการสแกน…</p>
        ) : hits.length === 0 ? (
          searched && <p className="py-6 text-center text-[13px] text-destructive">ไม่พบ batch นี้ในระบบ</p>
        ) : (
          hits.map((r) => (
            <button key={r.id} onClick={() => onOpen(r)}
              className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-secondary p-3.5 text-left">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold text-foreground">{r.title}</div>
                <div className="truncate text-[11px] text-muted-foreground" style={{ fontFamily: mono }}>BATCH {r.batch_no}</div>
                <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                  ลูกค้า: <b className="text-foreground">{r.customer_name || "-"}</b> · {r.quantity} · หมดอายุ {thaiDate(r.exp_date)}
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/* ============================================================
   ตัวอย่างสติกเกอร์ + ปุ่มปริ้น
   ============================================================ */
/** ตัวอย่างสติกเกอร์ตามสัดส่วนจริง — ย่อให้พอดีความกว้างที่มี */
export function LabelCanvas({ item, onScale }: { item: BatchLabel; onScale?: (s: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const [u, setU] = useState(0);
  const w = Number(item.width_mm) || BATCH_W;
  const h = Number(item.height_mm) || BATCH_H;
  const html = labelInnerHTML(item, "/logo-mark.png", 6);
  // คลาสเฉพาะใบนี้ กันสไตล์ชนกันเวลามีสติกเกอร์หลายใบอยู่ในหน้าเดียว
  const scope = `lbl${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setU(el.clientWidth / w);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  // วัดแล้วขยายตัวหนังสือให้เต็มกรอบ — ทำใหม่ทุกครั้งที่ขนาด/เนื้อหาเปลี่ยน
  useEffect(() => {
    const el = label.current;
    if (!el || !u) return;
    let dead = false;
    // eslint-disable-next-line no-new-func
    const run = new Function(`${FIT_FN}; fitLabel(arguments[0]);`);
    const fit = () => {
      if (dead || !label.current) return;
      label.current.style.removeProperty("--s");
      try { run(label.current); } catch { /* ไม่เป็นไร ใช้ค่าตั้งต้น */ }
      // ส่งค่าที่วัดได้ออกไป เพื่อให้ตอนปริ้นใช้ค่าเดียวกันเป๊ะ ๆ
      const s = parseFloat(label.current.style.getPropertyValue("--s"));
      if (onScale && s > 0) onScale(s);
    };
    // ต้องรอฟอนต์กับรูปโลโก้โหลดเสร็จก่อน ไม่งั้นวัดความสูงได้ค่าผิด
    const ready: Promise<unknown>[] = [];
    if (document.fonts?.ready) ready.push(document.fonts.ready);
    const img = el.querySelector("img");
    if (img && !img.complete) ready.push(new Promise((r) => { img.onload = r; img.onerror = r; }));
    fit();
    Promise.all(ready).then(() => requestAnimationFrame(fit));
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u, w, h, html]);

  return (
    <div ref={box} style={{ width: "100%" }}>
      {u > 0 && (
        <>
          <style>{labelCSS(w, h, scope)}</style>
          <div ref={label} className={`${scope} label shadow-sm`} style={{ ["--u" as any]: `${u}px` }}
            dangerouslySetInnerHTML={{ __html: html }} />
        </>
      )}
    </div>
  );
}

function LabelPreview({ item, onEdit, onDelete }: { item: BatchLabel; onEdit: () => void; onDelete: () => void }) {
  const [copies, setCopies] = useState("1");
  const [busyPdf, setBusyPdf] = useState<null | "a4" | "label">(null);
  const [pdfErr, setPdfErr] = useState("");
  // ขนาดตัวหนังสือที่ตัวอย่างวัดได้ — ส่งต่อให้ตอนปริ้นใช้ค่าเดียวกัน
  const scale = useRef<number | undefined>(undefined);

  const W = Number(item.width_mm) || BATCH_W;
  const H = Number(item.height_mm) || BATCH_H;
  // ขอบสติกเกอร์ชนกัน ไม่เว้นช่องไฟ · เส้นขอบห่างขอบกระดาษ 5mm
  const perPage = Math.max(1, Math.floor((210 - 10) / W)) * Math.max(1, Math.floor((297 - 10) / H));

  async function makePdf(mode: "a4" | "label") {
    setPdfErr(""); setBusyPdf(mode);
    try {
      const { openLabelsPdf } = await import("./labelPdf");
      await openLabelsPdf([{ item, copies: Math.max(1, Number(copies) || 1) }], mode);
      toast.success("สร้างไฟล์ PDF แล้ว");
    } catch (e) {
      setPdfErr("สร้างไฟล์ไม่สำเร็จ — ลองใหม่อีกครั้ง");
      console.error(e);
    }
    setBusyPdf(null);
  }

  return (
    <div className="pb-4">
      <div className="mb-3 overflow-hidden rounded-2xl bg-secondary p-3">
        <LabelCanvas item={item} onScale={(s) => { scale.current = s; }} />
      </div>
      <p className="mb-3 px-1 text-center text-[11px] text-muted-foreground">
        ขนาดสติกเกอร์ {Number(item.width_mm) || BATCH_W} × {Number(item.height_mm) || BATCH_H} mm
      </p>

      <div className="mb-3 rounded-2xl bg-secondary px-4 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
        ลูกค้า: <b className="text-foreground">{item.customer_name || "-"}</b><br />
        สร้างเมื่อ {new Date(item.created_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
        {item.note ? <><br />หมายเหตุ: {item.note}</> : null}
      </div>

      <Field label="จำนวนดวงที่ต้องการปริ้น">
        <input value={copies} onChange={(e) => setCopies(e.target.value.replace(/\D/g, "").slice(0, 3))}
          inputMode="numeric" placeholder="1" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
      </Field>

      {pdfErr && <p className="mb-2 text-center text-xs text-destructive">{pdfErr}</p>}

      <Button onClick={() => makePdf("a4")} disabled={busyPdf !== null}
        className="w-full rounded-2xl py-6 text-[15px]">
        {busyPdf === "a4"
          ? <><Loader2 size={16} className="animate-spin" /> กำลังสร้างไฟล์…</>
          : <><Printer size={16} /> ไฟล์ PDF ลงกระดาษ A4 ({perPage} ดวง/แผ่น)</>}
      </Button>
      <button onClick={() => makePdf("label")} disabled={busyPdf !== null}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-3.5 text-sm font-bold text-foreground">
        {busyPdf === "label"
          ? <><Loader2 size={15} className="animate-spin" /> กำลังสร้างไฟล์…</>
          : <><Printer size={15} /> ไฟล์ PDF เครื่องพิมพ์สติกเกอร์ ({W}×{H}mm)</>}
      </button>
      <p className="mt-2 px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        ได้ไฟล์ PDF ขนาดเป๊ะทุกมิลลิเมตร · เปิดไฟล์แล้วสั่งพิมพ์ <b className="text-foreground">มาตราส่วน 100%</b>
      </p>
      <button onClick={() => printLabels(item, Math.max(1, Number(copies) || 1), "a4", scale.current)}
        className="mt-3 w-full rounded-2xl py-2.5 text-[12px] font-semibold text-muted-foreground">
        หรือสั่งพิมพ์จากหน้าเว็บเลย (ขนาดอาจเพี้ยน)
      </button>

      <button onClick={onEdit} className="mt-3 w-full rounded-2xl bg-secondary py-3 text-sm font-semibold text-foreground">
        แก้ไขข้อมูล
      </button>
      <DeleteButton onClick={onDelete} label="ลบสติกเกอร์นี้" />
    </div>
  );
}

/* ============================================================
   สั่งปริ้น — เปิดหน้าต่างใหม่ที่จัดขนาดกระดาษไว้แล้ว
   mode "label" = เครื่องพิมพ์สติกเกอร์ 80x50mm (1 ดวง/แผ่น)
   mode "a4"    = กระดาษ A4 เรียงดวงละ 80x50mm แล้วตัดเอง
   ============================================================ */
export function printLabels(item: BatchLabel, copies: number, mode: "label" | "a4", scale?: number) {
  logAudit({ action: "view", entity: "batch-label-print", entityId: item.batch_no, newValue: { copies, mode } });
  const W = Number(item.width_mm) || BATCH_W;
  const H = Number(item.height_mm) || BATCH_H;
  const logo = `${window.location.origin}/logo-mark.png`;
  // ใช้ขนาดตัวหนังสือค่าเดียวกับที่เห็นในตัวอย่าง จะได้ออกมาเหมือนกันเป๊ะ
  const sAttr = scale && scale > 0 ? ` style="--s:${scale.toFixed(4)}"` : "";
  const one = `<div class="label"${sAttr}>${labelInnerHTML(item, logo, 8)}</div>`;
  // A4 เว้นขอบ 8mm -> พื้นที่พิมพ์จริง 194mm ล็อกความกว้างไว้เท่านี้
  // ทั้งบนจอและบนกระดาษจะได้เรียงเหมือนกัน ไม่ตกขอบ
  const SHEET_W = 210 - 8 * 2;
  const perRow = Math.max(1, Math.floor((SHEET_W + 4) / (W + 4)));

  const pageCss = mode === "label"
    ? `@page { size: ${W}mm ${H}mm; margin: 0 }
       body { margin: 0 }
       .sheet { width: ${W}mm; margin: 0 auto; display: flex; flex-direction: column; align-items: center }
       .label { page-break-after: always; border: none }
       .label:last-child { page-break-after: auto }`
    : `@page { size: A4; margin: 8mm }
       body { margin: 0 }
       /* ล็อกความกว้างเท่าพื้นที่พิมพ์จริง เรียง ${perRow} ดวง/แถว ไม่ตกขอบ */
       .sheet {
         width: ${SHEET_W}mm; margin: 0 auto;
         display: flex; flex-wrap: wrap; gap: 4mm;
         justify-content: center; align-content: flex-start;
       }
       .label { border-style: dashed; border-color: #bbb }`;

  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Batch ${esc(item.batch_no)}</title>
<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@500;700;800&family=Noto+Sans+Thai:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root { --u: 1mm }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact }
  html, body { overflow-x: hidden; max-width: 100% }
  body { background: #e9ebef; font-family: 'Urbanist','Noto Sans Thai',sans-serif }
  ${pageCss}
  ${labelCSS(W, H)}

  /* แถบปุ่มด้านบน — เห็นเฉพาะบนจอ ไม่ติดไปบนกระดาษ */
  .bar {
    position: sticky; top: 0; z-index: 9; display: flex; gap: 8px; align-items: center;
    padding: 10px 14px; background: #111214; color: #fff;
  }
  .bar b { flex: 1; min-width: 0; font-size: 13px; font-weight: 800;
           overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
  .bar button {
    border: none; border-radius: 999px; padding: 9px 14px; flex: none;
    font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit;
  }
  .b-back { background: #2A2B2E; color: #fff }
  .b-print { background: #014BAA; color: #fff }
  /* บนจอมือถือ ย่อทั้งแผ่นให้พอดีหน้าจอ แต่ตอนพิมพ์ใช้ขนาดจริงเสมอ
     ใช้ zoom เพราะมันย่อพื้นที่จริงด้วย (transform ย่อแค่ภาพ แผ่นจะยังล้นจอ) */
  .wrap { padding: 14px }
  @media print {
    body { background: #fff }
    .bar { display: none }
    .wrap { padding: 0 }
    .zoom { zoom: 1 !important }
  }
</style></head><body>
<div class="bar">
  <b>Batch ${esc(item.batch_no)} · ${copies} ดวง</b>
  <button class="b-back" onclick="window.close()">ปิดหน้านี้</button>
  <button class="b-print" onclick="window.print()">สั่งปริ้นอีกครั้ง</button>
</div>
<div class="wrap"><div class="zoom"><div class="sheet">${one.repeat(copies)}</div></div></div>
<script>
  ${FIT_FN}
  var LOCKED = ${scale && scale > 0 ? "true" : "false"};
  // ย่อทั้งแผ่นให้พอดีจอ (เฉพาะบนจอ — ตอนพิมพ์ CSS สั่ง zoom:1 ใช้ขนาดจริง)
  function fitScreen() {
    var z = document.querySelector('.zoom'), wrap = document.querySelector('.wrap');
    if (!z || !wrap) return;
    z.style.zoom = '1';
    var k = Math.min(1, wrap.clientWidth / z.scrollWidth);
    z.style.zoom = String(k);
  }
  window.onload = function () {
    var go = function () {
      // ถ้ามีค่าขนาดตัวหนังสือจากตัวอย่างแล้ว ใช้ค่านั้นเลย จะได้ออกมาเหมือนตัวอย่างเป๊ะ
      if (!LOCKED) [].forEach.call(document.querySelectorAll('.label'), fitLabel);
      fitScreen();
      setTimeout(function () { window.print(); }, 250);
    };
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); } else { go(); }
  };
  window.addEventListener('resize', fitScreen);
<\/script>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) { toast.error("เบราว์เซอร์บล็อกหน้าต่างปริ้น — อนุญาต popup ก่อน"); return; }
  win.document.write(html);
  win.document.close();
}

/* ============================================================
   ฟอร์มสร้าง / แก้ไขสติกเกอร์
   ============================================================ */
function LabelForm({ initial, customers, products, onDone, onDelete }: {
  initial: BatchLabel | null;
  customers: Customer[];
  products: Product[];
  onDone: () => void;
  onDelete?: () => void;
}) {
  const [productId, setProductId] = useState(initial?.product_id || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [code, setCode] = useState(initial?.code || "");
  const [batchNo, setBatchNo] = useState(initial?.batch_no || "");
  const [mfg, setMfg] = useState(initial?.mfg_date || today());
  const [exp, setExp] = useState(initial?.exp_date || plusTwoYears(today()));
  const [qty, setQty] = useState(initial?.quantity ?? "");
  const [customerId, setCustomerId] = useState(initial?.customer_id || "");
  const [note, setNote] = useState(initial?.note || "");
  const [wmm, setWmm] = useState(String(initial?.width_mm ?? BATCH_W));
  const [hmm, setHmm] = useState(String(initial?.height_mm ?? BATCH_H));
  const [showDm, setShowDm] = useState(initial?.show_dm !== false);
  const [showLogo, setShowLogo] = useState(initial?.show_logo !== false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  /** เลือกสินค้า = เติมชื่อ + CODE ให้ แต่ยังพิมพ์แก้เองได้ */
  function pickProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) { setTitle(p.name); if (!code.trim()) setCode(p.sku); }
  }
  /** เปลี่ยนวันผลิต = เลื่อนวันหมดอายุเป็น +2 ปีให้อัตโนมัติ */
  function changeMfg(d: string) {
    const prevAuto = plusTwoYears(mfg);
    setMfg(d);
    // เติมให้เมื่อวันหมดอายุยังว่าง หรือยังเป็นค่าที่ระบบเติมไว้ (ไม่ทับค่าที่ผู้ใช้ตั้งเอง)
    if (!exp || exp === prevAuto) setExp(plusTwoYears(d));
  }

  const dmPreview = useMemo(() => dataMatrixSVG(dmPayload(code, batchNo), 4), [code, batchNo]);

  async function save() {
    if (!title.trim()) { setErr("ต้องใส่ชื่อรายการ"); return; }
    if (!batchNo.trim()) { setErr("ต้องใส่ BATCH NO"); return; }
    if (!mfg) { setErr("ต้องเลือกวันผลิต (MFG. DATE)"); return; }
    if (!exp) { setErr("ต้องมีวันหมดอายุ (EXP. DATE)"); return; }
    if (!qty.trim()) { setErr("ต้องใส่จำนวน (QUANTITY)"); return; }
    const W = Number(wmm), H = Number(hmm);
    if (!W || !H || W < 10 || H < 10) { setErr("ขนาดสติกเกอร์ต้องไม่ต่ำกว่า 10 mm"); return; }
    setErr(""); setBusy(true);

    const cust = customers.find((c) => c.id === customerId);
    const payload = {
      title: title.trim(),
      product_id: productId || null,
      code: code.trim() || null,
      batch_no: batchNo.trim(),
      mfg_date: mfg,
      exp_date: exp,
      quantity: qty.trim(),
      customer_id: customerId || null,
      customer_name: cust?.name || null,
      note: note.trim() || null,
      width_mm: W,
      height_mm: H,
      show_dm: showDm,
      show_logo: showLogo,
    };
    const { error } = initial
      ? await supabase.from("batch_labels").update(payload).eq("id", initial.id)
      : await supabase.from("batch_labels").insert(payload);
    if (error) { setErr(error.message); toast.error("บันทึกไม่สำเร็จ"); setBusy(false); return; }
    await logAudit({
      action: initial ? "update" : "create", entity: "batch-label",
      entityId: payload.batch_no, oldValue: initial || undefined, newValue: payload,
    });
    toast.success(initial ? "แก้ไขแล้ว" : "สร้างสติกเกอร์แล้ว");
    onDone();
  }

  const ClearBtn = ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick} aria-label="ล้าง"
      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-muted-foreground">
      <X size={13} />
    </button>
  );

  return (
    <div className="pb-4">
      <Field label="เลือกจากสินค้าในระบบ (ไม่บังคับ — เลือกแล้วเติมชื่อให้)">
        <select value={productId} onChange={(e) => pickProduct(e.target.value)}
          className="w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
          <option value="">ไม่เลือก / พิมพ์ชื่อเอง</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>

      <Field label="ชื่อรายการ *">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น Nuit de Vétiver"
          className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
      </Field>

      <Field label="CODE (ไม่บังคับ)">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="NS-EDP-001"
          className="w-full rounded-2xl px-4 py-3" style={{ ...inputStyle, fontFamily: mono }} />
      </Field>

      <Field label="BATCH NO *">
        <input value={batchNo} onChange={(e) => setBatchNo(e.target.value)} placeholder="B2026-001"
          className="w-full rounded-2xl px-4 py-3" style={{ ...inputStyle, fontFamily: mono }} />
      </Field>
      {dmPreview && (
        <div className="-mt-1 mb-3 flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3">
          <div style={{ width: 54, height: 54 }}
            dangerouslySetInnerHTML={{ __html: dmPreview.replace("<svg ", '<svg style="width:100%;height:100%" ') }} />
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            Data Matrix ของ batch นี้<br />
            ยิงสแกนแล้วได้ <b className="text-foreground" style={{ fontFamily: mono }}>{dmPayload(code, batchNo)}</b>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
        <Field label="MFG. DATE *">
          <div className="relative min-w-0">
            <input type="date" value={mfg} onChange={(e) => changeMfg(e.target.value)}
              className="box-border w-full min-w-0 appearance-none rounded-2xl px-3 py-3 pr-8 text-[13px]" style={inputStyle} />
            {mfg && <ClearBtn onClick={() => setMfg("")} />}
          </div>
        </Field>
        <Field label="EXP. DATE *">
          <div className="relative min-w-0">
            <input type="date" value={exp} onChange={(e) => setExp(e.target.value)}
              className="box-border w-full min-w-0 appearance-none rounded-2xl px-3 py-3 pr-8 text-[13px]" style={inputStyle} />
            {exp && <ClearBtn onClick={() => setExp("")} />}
          </div>
        </Field>
      </div>
      <p className="-mt-1 mb-3 px-1 text-[11px] text-muted-foreground">
        วันหมดอายุเติมให้อัตโนมัติ = วันผลิต + 2 ปี (แก้เองได้)
      </p>

      <Field label="QUANTITY *">
        <input value={qty} onChange={(e) => setQty(e.target.value)}
          placeholder="เช่น 4 x 5.0 KG. หรือ 100 ชิ้น"
          className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
      </Field>

      <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
        <Field label="กว้าง (mm)">
          <input value={wmm} onChange={(e) => setWmm(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal"
            className="box-border w-full min-w-0 rounded-2xl px-3 py-3 text-[13px]" style={inputStyle} />
        </Field>
        <Field label="สูง (mm)">
          <input value={hmm} onChange={(e) => setHmm(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal"
            className="box-border w-full min-w-0 rounded-2xl px-3 py-3 text-[13px]" style={inputStyle} />
        </Field>
      </div>
      <div className="-mt-1 mb-3 flex items-center gap-2 px-1">
        <p className="flex-1 text-[11px] text-muted-foreground">
          Batch Label แนะนำ <b className="text-foreground">{BATCH_W} × {BATCH_H} mm</b> · เปลี่ยนขนาดแล้วตัวหนังสือย่อ/ขยายตามเอง
        </p>
        {(Number(wmm) !== BATCH_W || Number(hmm) !== BATCH_H) && (
          <button type="button" onClick={() => { setWmm(String(BATCH_W)); setHmm(String(BATCH_H)); }}
            className="shrink-0 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-foreground">
            ใช้ขนาดแนะนำ
          </button>
        )}
      </div>

      {/* เปิด/ปิดสิ่งที่อยู่บนสติกเกอร์ — ปิดทั้งคู่ = ตัวหนังสือได้พื้นที่เต็มใบ */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {([["บาร์โค้ด", showDm, setShowDm], ["โลโก้", showLogo, setShowLogo]] as const).map(([name, on, set]) => (
          <button key={name} type="button" onClick={() => set(!on)}
            className="flex items-center justify-between rounded-2xl px-4 py-3 text-[13px] font-semibold"
            style={on ? { background: C.brandSoft, color: C.brand } : { background: C.bg, color: C.sub }}>
            {name}
            <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
              style={on ? { background: C.brand, color: "#fff" } : { background: "#C9CDD3", color: "#fff" }}>
              {on ? "ใส่" : "ไม่ใส่"}
            </span>
          </button>
        ))}
      </div>

      {/* ตัวอย่างสติกเกอร์สด ๆ ตามที่กรอก */}
      {title.trim() && batchNo.trim() && Number(wmm) >= 10 && Number(hmm) >= 10 && (
        <div className="mb-3 overflow-hidden rounded-2xl bg-secondary p-3">
          <p className="mb-2 text-center text-[11px] font-semibold text-muted-foreground">ตัวอย่างสติกเกอร์</p>
          <LabelCanvas item={{
            id: "", title: title.trim(), product_id: null, code: code.trim() || null,
            batch_no: batchNo.trim(), mfg_date: mfg, exp_date: exp, quantity: qty.trim(),
            customer_id: null, customer_name: null, note: null,
            width_mm: Number(wmm), height_mm: Number(hmm),
            show_dm: showDm, show_logo: showLogo, created_at: new Date().toISOString(),
          }} />
        </div>
      )}

      <Field label="ลูกค้า (ใช้ตอนย้อนดูว่า batch นี้ส่งให้ใคร)">
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
          className="w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
          <option value="">ยังไม่ระบุ</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>

      <Field label="หมายเหตุ (ไม่บังคับ — ไม่ขึ้นบนสติกเกอร์)">
        <input value={note} onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
      </Field>

      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">
        {busy ? "กำลังบันทึก…" : "บันทึก"}
      </Button>
      {onDelete && <DeleteButton onClick={onDelete} label="ลบสติกเกอร์นี้" />}
    </div>
  );
}
