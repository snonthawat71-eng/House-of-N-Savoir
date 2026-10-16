import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Plus, Loader2, Tags, ChevronRight, ChevronLeft, Printer, ScanLine, Search, X } from "lucide-react";
import { toSVG } from "bwip-js/browser";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, mono, inputStyle } from "../lib/ui";
import { toast } from "../lib/toast";
import { Field } from "./B2B";
import { Modal, DeleteButton } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

/* ---------------- ชนิดข้อมูล ---------------- */
export type BatchLabel = {
  id: string; title: string; product_id: string | null; code: string | null;
  batch_no: string; mfg_date: string; exp_date: string; quantity: string;
  customer_id: string | null; customer_name: string | null; note: string | null;
  width_mm: number; height_mm: number; created_at: string;
};

/** ขนาดสติกเกอร์แนะนำของ Batch Label */
export const BATCH_W = 80;
export const BATCH_H = 50;
type Customer = { id: string; name: string };
type Product = { id: string; name: string; sku: string };

/* ---------------- ตัวช่วย ---------------- */
const today = () => new Date().toISOString().slice(0, 10);
/** วันหมดอายุ = วันผลิต + 2 ปี (เติมให้อัตโนมัติ) */
export function plusTwoYears(d: string) {
  if (!d) return "";
  const t = new Date(d + "T00:00:00");
  if (isNaN(t.getTime())) return "";
  t.setFullYear(t.getFullYear() + 2);
  return t.toISOString().slice(0, 10);
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

/** Data Matrix เก็บแค่ BATCH NO — คนนอกยิงได้แค่เลข batch ไม่เห็นข้อมูลลูกค้า */
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
export function labelCSS(w: number, h: number) {
  const r = (n: number) => +n.toFixed(3);
  return `
  .label{
    width:calc(var(--u) * ${r(w)}); height:calc(var(--u) * ${r(h)});
    padding:calc(var(--u) * ${r(h * 0.075)});
    border:calc(var(--u) * ${r(h * 0.009)}) solid #111;
    background:#fff; color:#111214; overflow:hidden;
    display:flex; flex-direction:column; justify-content:space-between;
    font-family:'Urbanist','Noto Sans Thai',Arial,sans-serif;
    line-height:1.1;
  }
  .l-title{
    font-weight:800; font-size:calc(var(--u) * ${r(h * 0.092)});
    line-height:1.05; word-break:break-word;
  }
  .l-code{
    font-weight:500; font-size:calc(var(--u) * ${r(h * 0.054)});
    margin-top:calc(var(--u) * ${r(h * 0.022)});
  }
  .l-code b{ font-weight:500; margin-left:calc(var(--u) * ${r(h * 0.05)}) }
  .l-rows{
    display:grid; grid-template-columns:auto auto 1fr;
    column-gap:calc(var(--u) * ${r(h * 0.05)});
    row-gap:calc(var(--u) * ${r(h * 0.028)});
    font-size:calc(var(--u) * ${r(h * 0.054)}); font-weight:500;
    margin-top:calc(var(--u) * ${r(h * 0.085)});
  }
  .l-foot{ display:flex; align-items:flex-end; justify-content:space-between; gap:calc(var(--u) * ${r(h * 0.04)}) }
  .l-brand{ display:flex; align-items:center; gap:calc(var(--u) * ${r(h * 0.035)}) }
  .l-brand img{ height:calc(var(--u) * ${r(h * 0.072)}); width:auto; display:block }
  .l-brand span{ font-weight:800; font-size:calc(var(--u) * ${r(h * 0.036)}); letter-spacing:calc(var(--u) * ${r(h * 0.004)}) }
  .l-dm{ width:calc(var(--u) * ${r(h * 0.23)}); height:calc(var(--u) * ${r(h * 0.23)}); flex:none }
  .l-dm svg{ width:100%; height:100%; display:block; shape-rendering:crispEdges }
  `;
}

/** เนื้อหาในสติกเกอร์ (HTML ชุดเดียว ใช้ทั้งดูตัวอย่างและปริ้น) */
export function labelInnerHTML(item: BatchLabel, logoUrl: string, dmScale = 6) {
  const svg = dataMatrixSVG(item.batch_no, dmScale);
  const row = (k: string, v: string) => `<div>${k}</div><div>:</div><div>${esc(v)}</div>`;
  return `
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
  <div class="l-foot">
    <div class="l-brand"><img src="${logoUrl}" alt=""><span>HOUSE OF N SAVOIR</span></div>
    <div class="l-dm">${svg}</div>
  </div>`;
}

/* ============================================================
   หน้า Print — รวมงานปริ้นทั้งหมด
   ============================================================ */
export default function PrintScreen() {
  const [open, setOpen] = useState<null | "batch">(null);
  useEffect(() => { logAudit({ action: "view", entity: "screen", entityId: "print" }); }, []);
  useBackHandler(open !== null, () => setOpen(null));

  if (open === "batch") return <BatchLabels onBack={() => setOpen(null)} />;

  return (
    <div className="px-5 pb-32">
      <p className="mb-3 mt-2 px-1 text-xs text-muted-foreground">งานที่พร้อมสั่งปริ้นได้ทันที</p>
      <button onClick={() => setOpen("batch")}
        className="flex w-full items-center justify-between rounded-3xl bg-card p-4 text-left shadow-sm">
        <div className="flex items-center gap-3">
          <Tags size={26} strokeWidth={1.8} className="shrink-0 text-foreground" />
          <div>
            <div className="font-disp text-[15px] font-bold text-foreground">Batch Label</div>
            <div className="text-[11px] text-muted-foreground">สติกเกอร์ติดส่งลูกค้า 80×50mm · มี Data Matrix</div>
          </div>
        </div>
        <ChevronRight size={18} className="text-muted-foreground" />
      </button>
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

  const load = useCallback(async () => {
    const [l, c, p] = await Promise.all([
      supabase.from("batch_labels")
        .select("id,title,product_id,code,batch_no,mfg_date,exp_date,quantity,customer_id,customer_name,note,width_mm,height_mm,created_at")
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
      <button onClick={onBack} className="mt-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground">
        <ChevronLeft size={16} /> งานปริ้นทั้งหมด
      </button>
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

      <button onClick={() => setModal({ k: "form", item: null })}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white"
        style={{ background: C.brand }}>
        <Plus size={16} /> สร้างสติกเกอร์ใหม่
      </button>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          {rows.length === 0 ? "ยังไม่มีสติกเกอร์ — กด สร้างสติกเกอร์ใหม่" : "ไม่พบรายการที่ค้นหา"}
        </p>
      ) : (
        shown.map((r) => (
          <button key={r.id} onClick={() => setModal({ k: "view", item: r })}
            className="mb-2.5 flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-disp text-[15px] font-extrabold text-foreground">{r.title}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground" style={{ fontFamily: mono }}>
                BATCH {r.batch_no}{r.code ? ` · ${r.code}` : ""}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-muted-foreground">
                <span>ผลิต {thaiDate(r.mfg_date)}</span>
                <span>หมดอายุ {thaiDate(r.exp_date)}</span>
                <span>{r.quantity}</span>
              </div>
              {r.customer_name && <div className="mt-0.5 truncate text-[10.5px] font-semibold text-primary">{r.customer_name}</div>}
            </div>
            <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
          </button>
        ))
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
    return rows.filter((r) => r.batch_no.toLowerCase() === s);
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
export function LabelCanvas({ item }: { item: BatchLabel }) {
  const box = useRef<HTMLDivElement>(null);
  const [u, setU] = useState(0);
  const w = Number(item.width_mm) || BATCH_W;
  const h = Number(item.height_mm) || BATCH_H;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setU(el.clientWidth / w);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  return (
    <div ref={box} style={{ width: "100%" }}>
      {u > 0 && (
        <>
          <style>{labelCSS(w, h)}</style>
          <div className="label shadow-sm" style={{ ["--u" as any]: `${u}px` }}
            dangerouslySetInnerHTML={{ __html: labelInnerHTML(item, "/logo-mark.png", 6) }} />
        </>
      )}
    </div>
  );
}

function LabelPreview({ item, onEdit, onDelete }: { item: BatchLabel; onEdit: () => void; onDelete: () => void }) {
  const [copies, setCopies] = useState("1");

  return (
    <div className="pb-4">
      <div className="mb-3 overflow-hidden rounded-2xl bg-secondary p-3">
        <LabelCanvas item={item} />
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

      <Button onClick={() => printLabels(item, Math.max(1, Number(copies) || 1), "label")}
        className="w-full rounded-2xl py-6 text-[15px]">
        <Printer size={16} /> ปริ้นเครื่องสติกเกอร์ ({Number(item.width_mm) || BATCH_W}×{Number(item.height_mm) || BATCH_H}mm)
      </Button>
      <button onClick={() => printLabels(item, Math.max(1, Number(copies) || 1), "a4")}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-3.5 text-sm font-bold text-foreground">
        <Printer size={15} /> ปริ้นลงกระดาษ A4 (เรียงหลายดวง)
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
export function printLabels(item: BatchLabel, copies: number, mode: "label" | "a4") {
  logAudit({ action: "view", entity: "batch-label-print", entityId: item.batch_no, newValue: { copies, mode } });
  const W = Number(item.width_mm) || BATCH_W;
  const H = Number(item.height_mm) || BATCH_H;
  const logo = `${window.location.origin}/logo-mark.png`;
  const one = `<div class="label">${labelInnerHTML(item, logo, 8)}</div>`;

  const pageCss = mode === "label"
    ? `@page { size: ${W}mm ${H}mm; margin: 0 }
       body { margin: 0 }
       .label { page-break-after: always; border: none }
       .label:last-child { page-break-after: auto }`
    : `@page { size: A4; margin: 8mm }
       body { margin: 0 }
       .sheet { display: flex; flex-wrap: wrap; gap: 4mm }
       .label { border-style: dashed; border-color: #bbb }`;

  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8">
<title>Batch ${esc(item.batch_no)}</title>
<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@500;700;800&family=Noto+Sans+Thai:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root { --u: 1mm }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact }
  ${pageCss}
  ${labelCSS(W, H)}
</style></head><body>
${mode === "a4" ? `<div class="sheet">${one.repeat(copies)}</div>` : one.repeat(copies)}
<script>
  // รอให้ฟอนต์กับโลโก้โหลดเสร็จก่อน ไม่งั้นสติกเกอร์อาจออกมาผิดขนาด
  window.onload = function () {
    var go = function () { setTimeout(function () { window.print(); }, 250); };
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); } else { go(); }
  };
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

  const dmPreview = useMemo(() => dataMatrixSVG(batchNo.trim(), 4), [batchNo]);

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
            Data Matrix ของ batch นี้<br />ยิงสแกนแล้วได้เลข <b className="text-foreground">{batchNo.trim()}</b>
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

      {/* ตัวอย่างสติกเกอร์สด ๆ ตามที่กรอก */}
      {title.trim() && batchNo.trim() && Number(wmm) >= 10 && Number(hmm) >= 10 && (
        <div className="mb-3 overflow-hidden rounded-2xl bg-secondary p-3">
          <p className="mb-2 text-center text-[11px] font-semibold text-muted-foreground">ตัวอย่างสติกเกอร์</p>
          <LabelCanvas item={{
            id: "", title: title.trim(), product_id: null, code: code.trim() || null,
            batch_no: batchNo.trim(), mfg_date: mfg, exp_date: exp, quantity: qty.trim(),
            customer_id: null, customer_name: null, note: null,
            width_mm: Number(wmm), height_mm: Number(hmm), created_at: new Date().toISOString(),
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
