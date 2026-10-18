import { useEffect, useState, useCallback, useMemo, useRef, useId } from "react";
import { Plus, Loader2, ChevronRight, Printer, ScanLine, Search, X, Check, CheckSquare } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, mono, inputStyle } from "../lib/ui";
import { toast } from "../lib/toast";
import { Field } from "@/components/ui/field";
import { Modal, DeleteButton } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  FO_W, FO_H, foPerSheet, GHS, ghsUrl, foDate, foToday, plusTwoYears,
  lastHp, lastStorage, rememberLines, DEFAULT_HP, DEFAULT_STORAGE, type FoLabel,
} from "./foLabel";
import { foCSS, foInnerHTML, FO_FIT_FN } from "./foLabelRender";

type Customer = { id: string; name: string };
const COLS =
  "id,code,name,gross_min,tare_min,net,mfg_date,bbe_date,batch_of,signal_word,pictograms," +
  "hp_codes,storage_text,customer_id,customer_name,note,width_mm,height_mm,created_at";

/* ---------------- ตัวอย่างฉลากตามสัดส่วนจริง ---------------- */
export function FoCanvas({ item, onScale }: { item: FoLabel; onScale?: (s: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const [u, setU] = useState(0);
  const w = Number(item.width_mm) || FO_W;
  const h = Number(item.height_mm) || FO_H;
  const html = foInnerHTML(item, 6);
  const scope = `fo${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setU(el.clientWidth / w);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  useEffect(() => {
    const el = label.current;
    if (!el || !u) return;
    let dead = false;
    // eslint-disable-next-line no-new-func
    const run = new Function(`${FO_FIT_FN}; fitFo(arguments[0]);`);
    const fit = () => {
      if (dead || !label.current) return;
      label.current.style.removeProperty("--s");
      try { run(label.current); } catch { /* ใช้ค่าตั้งต้น */ }
      const s = parseFloat(label.current.style.getPropertyValue("--s"));
      if (onScale && s > 0) onScale(s);
    };
    const ready: Promise<unknown>[] = [];
    if (document.fonts?.ready) ready.push(document.fonts.ready);
    el.querySelectorAll("img").forEach((img) => {
      if (!img.complete) ready.push(new Promise((r) => { img.onload = r; img.onerror = r; }));
    });
    fit();
    Promise.all(ready).then(() => requestAnimationFrame(fit));
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u, w, h, html]);

  return (
    <div ref={box} style={{ width: "100%" }}>
      {u > 0 && (
        <>
          <style>{foCSS(w, h, scope)}</style>
          <div ref={label} className={`${scope} fo shadow-sm`} style={{ ["--u" as any]: `${u}px` }}
            dangerouslySetInnerHTML={{ __html: html }} />
        </>
      )}
    </div>
  );
}

/* ============================================================
   FO Label — รายการทั้งหมด + เพิ่ม/แก้ไข/ลบ + สแกน + ปริ้นหลายรายการ
   ============================================================ */
type ModalState = { k: "form"; item: FoLabel | null } | { k: "view"; item: FoLabel } | { k: "scan" } | null;

export default function FoLabels({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<FoLabel[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [pick, setPick] = useState(false);
  const [sel, setSel] = useState<Map<string, number>>(new Map());
  const [busy, setBusy] = useState<null | "a4" | "label">(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [l, c] = await Promise.all([
      supabase.from("fo_labels").select(COLS).order("created_at", { ascending: false }).limit(300),
      supabase.from("customers").select("id,name").order("name"),
    ]);
    setRows((l.data as unknown as FoLabel[]) || []);
    setCustomers((c.data as Customer[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useBackHandler(true, () => { if (modal) setModal(null); else if (pick) { setPick(false); setSel(new Map()); } else onBack(); });

  const sizeOf = (r: FoLabel) => `${Number(r.width_mm) || FO_W}×${Number(r.height_mm) || FO_H}mm`;
  const lockSize = useMemo(() => {
    const f = rows.find((r) => sel.has(r.id));
    return f ? sizeOf(f) : null;
  }, [rows, sel]);
  const totalCopies = useMemo(() => [...sel.values()].reduce((a, b) => a + b, 0), [sel]);
  const sheets = useMemo(() => {
    const f = rows.find((r) => sel.has(r.id));
    if (!f) return 0;
    const per = foPerSheet(Number(f.width_mm) || FO_W, Number(f.height_mm) || FO_H);
    return Math.ceil(totalCopies / per);
  }, [rows, sel, totalCopies]);

  const toggleSel = (r: FoLabel) => setSel((m) => {
    const n = new Map(m);
    if (n.has(r.id)) n.delete(r.id); else n.set(r.id, 1);
    return n;
  });
  const setCopiesFor = (id: string, v: string) => setSel((m) => {
    const n = new Map(m);
    n.set(id, Math.min(999, Number(v.replace(/\D/g, "")) || 0));
    return n;
  });

  async function del(it: FoLabel) {
    if (!confirm(`ลบฉลาก ${it.batch_of}?`)) return;
    const { error } = await supabase.from("fo_labels").delete().eq("id", it.id);
    if (error) { toast.error("ลบไม่สำเร็จ"); return; }
    await logAudit({ action: "delete", entity: "fo-label", entityId: it.batch_of, oldValue: it });
    toast.success("ลบแล้ว");
    setModal(null); load();
  }

  async function makePdf(mode: "a4" | "label", jobs: { item: FoLabel; copies: number }[]) {
    if (!jobs.length) { setErr("ใส่จำนวนดวงอย่างน้อย 1 รายการ"); return; }
    setErr(""); setBusy(mode);
    try {
      const { openFoPdf } = await import("./foPdf");
      await openFoPdf(jobs, mode);
      await logAudit({ action: "view", entity: "fo-label-print", entityId: jobs[0].item.batch_of, newValue: { mode, n: jobs.length } });
      toast.success("สร้างไฟล์ PDF แล้ว");
      if (pick) { setPick(false); setSel(new Map()); }
    } catch (e) {
      setErr("สร้างไฟล์ไม่สำเร็จ — ลองใหม่อีกครั้ง");
      console.error(e);
    }
    setBusy(null);
  }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.batch_of.toLowerCase().includes(s) || r.name.toLowerCase().includes(s) ||
      r.code.toLowerCase().includes(s) || (r.customer_name || "").toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div className="px-5 pb-32">
      <div className="mb-3 mt-2">
        <div className="font-disp text-xl font-extrabold text-foreground">FO Label</div>
        <div className="text-[11px] text-muted-foreground">{rows.length} ใบที่เคยสร้าง</div>
      </div>

      <div className="mb-3 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm">
          <Search size={16} className="shrink-0 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา batch / ชื่อ / code"
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
              ? <span className="text-muted-foreground">ติ๊กเลือกฉลากที่จะปริ้น</span>
              : <>เลือก <b className="text-foreground">{sel.size} รายการ</b> · รวม <b className="text-foreground">{totalCopies} ดวง</b>
                  <span className="text-muted-foreground"> · ขนาด {lockSize}</span></>}
          </div>
          <button onClick={() => { setPick(false); setSel(new Map()); }}
            className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-semibold text-muted-foreground">ยกเลิก</button>
        </div>
      ) : (
        <div className="mb-4 flex gap-2">
          <button onClick={() => setModal({ k: "form", item: null })}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white"
            style={{ background: C.brand }}>
            <Plus size={16} /> สร้างฉลากใหม่
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
          {rows.length === 0 ? "ยังไม่มีฉลาก — กด สร้างฉลากใหม่" : "ไม่พบรายการที่ค้นหา"}
        </p>
      ) : (
        shown.map((r) => {
          const on = sel.has(r.id);
          const blocked = pick && !on && lockSize !== null && sizeOf(r) !== lockSize;
          return (
            <div key={r.id} className="mb-2.5 flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm"
              style={{ opacity: blocked ? 0.4 : 1, border: on ? `1.5px solid ${C.brand}` : "1.5px solid transparent" }}>
              {pick && (
                <button onClick={() => !blocked && toggleSel(r)} disabled={blocked} aria-label="เลือก"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2"
                  style={on ? { background: C.brand, borderColor: C.brand } : { borderColor: "#C9CDD3" }}>
                  {on && <Check size={14} strokeWidth={3} className="text-white" />}
                </button>
              )}
              <button onClick={() => (pick ? !blocked && toggleSel(r) : setModal({ k: "view", item: r }))}
                disabled={blocked} className="min-w-0 flex-1 text-left">
                <div className="truncate font-disp text-[15px] font-extrabold text-foreground">{r.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground" style={{ fontFamily: mono }}>
                  {r.code} · OF {r.batch_of}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-muted-foreground">
                  <span>ผลิต {foDate(r.mfg_date)}</span>
                  <span>BBE {foDate(r.bbe_date)}</span>
                  <span>{sizeOf(r)}</span>
                </div>
                {blocked && <div className="mt-1 text-[10.5px] font-semibold text-destructive">ขนาดไม่ตรงกับที่เลือกไว้</div>}
              </button>
              {pick ? (
                on && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <input value={String(sel.get(r.id) ?? 1)} onChange={(e) => setCopiesFor(r.id, e.target.value)}
                      inputMode="numeric" aria-label="จำนวนดวง"
                      className="w-14 rounded-xl py-2 text-center text-[14px] font-bold" style={inputStyle} />
                    <span className="text-[10.5px] text-muted-foreground">ดวง</span>
                  </div>
                )
              ) : <ChevronRight size={16} className="shrink-0 text-muted-foreground" />}
            </div>
          );
        })
      )}

      {pick && sel.size > 0 && (
        <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-5 pb-5 pt-3"
          style={{ background: "linear-gradient(to top, rgba(241,242,244,1) 55%, rgba(241,242,244,0))" }}>
          {err && <p className="mb-2 text-center text-xs text-destructive">{err}</p>}
          <button
            onClick={() => makePdf("a4", rows.filter((r) => (sel.get(r.id) ?? 0) > 0).map((r) => ({ item: r, copies: sel.get(r.id)! })))}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white"
            style={{ background: C.brand, opacity: busy ? 0.6 : 1 }}>
            {busy === "a4" ? <><Loader2 size={16} className="animate-spin" /> กำลังสร้างไฟล์…</>
                           : <><Printer size={16} /> PDF รวม {totalCopies} ดวง ({sheets} แผ่น A4)</>}
          </button>
          <button
            onClick={() => makePdf("label", rows.filter((r) => (sel.get(r.id) ?? 0) > 0).map((r) => ({ item: r, copies: sel.get(r.id)! })))}
            disabled={busy !== null}
            className="mt-2 w-full rounded-2xl bg-card py-3 text-[12.5px] font-bold text-foreground shadow-sm">
            {busy === "label" ? "กำลังสร้างไฟล์…" : `PDF เครื่องพิมพ์สติกเกอร์ (${lockSize})`}
          </button>
        </div>
      )}

      <Modal open={modal?.k === "view"} onClose={() => setModal(null)} title="ฉลาก FO Label">
        {modal?.k === "view" && (
          <FoPreview item={modal.item} busy={busy} err={err}
            onPdf={(mode, copies) => makePdf(mode, [{ item: modal.item, copies }])}
            onEdit={() => setModal({ k: "form", item: modal.item })}
            onDelete={() => del(modal.item)} />
        )}
      </Modal>

      <Modal open={modal?.k === "form"} onClose={() => setModal(null)}
        title={modal?.k === "form" && modal.item ? "แก้ไขฉลาก" : "สร้างฉลากใหม่"}>
        {modal?.k === "form" && (
          <FoForm initial={modal.item} customers={customers}
            onDone={() => { setModal(null); load(); }}
            onDelete={modal.item ? () => del(modal.item!) : undefined} />
        )}
      </Modal>

      <Modal open={modal?.k === "scan"} onClose={() => setModal(null)} title="สแกน Data Matrix">
        {modal?.k === "scan" && <FoScan rows={rows} onOpen={(it) => setModal({ k: "view", item: it })} />}
      </Modal>
    </div>
  );
}

/* ---------------- สแกนหา batch ---------------- */
function FoScan({ rows, onOpen }: { rows: FoLabel[]; onOpen: (it: FoLabel) => void }) {
  const [code, setCode] = useState("");
  const hits = useMemo(() => {
    const s = code.trim().toLowerCase();
    if (!s) return [];
    return rows.filter((r) => r.batch_of.toLowerCase() === s || r.code.toLowerCase() === s);
  }, [rows, code]);

  return (
    <div className="pb-4">
      <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
        เอาเครื่องสแกนยิงที่ Data Matrix บนฉลากได้เลย (หรือพิมพ์เลข Batch (OF) เองก็ได้)
      </p>
      <input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="ยิงสแกนตรงนี้…"
        className="w-full rounded-2xl px-4 py-4 text-center"
        style={{ ...inputStyle, fontFamily: mono, fontSize: 18, letterSpacing: 1 }} />
      <div className="mt-4">
        {!code.trim() ? <p className="py-6 text-center text-[12.5px] text-muted-foreground">รอรับการสแกน…</p>
          : hits.length === 0 ? <p className="py-6 text-center text-[13px] text-destructive">ไม่พบ batch นี้ในระบบ</p>
          : hits.map((r) => (
            <button key={r.id} onClick={() => onOpen(r)}
              className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-secondary p-3.5 text-left">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold text-foreground">{r.name}</div>
                <div className="truncate text-[11px] text-muted-foreground" style={{ fontFamily: mono }}>{r.code} · OF {r.batch_of}</div>
                <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                  Net {r.net} · BBE {foDate(r.bbe_date)}{r.customer_name ? ` · ${r.customer_name}` : ""}
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
            </button>
          ))}
      </div>
    </div>
  );
}

/* ---------------- ตัวอย่าง + ปุ่มสร้าง PDF ---------------- */
function FoPreview({ item, busy, err, onPdf, onEdit, onDelete }: {
  item: FoLabel; busy: null | "a4" | "label"; err: string;
  onPdf: (mode: "a4" | "label", copies: number) => void;
  onEdit: () => void; onDelete: () => void;
}) {
  const [copies, setCopies] = useState("1");
  const W = Number(item.width_mm) || FO_W;
  const H = Number(item.height_mm) || FO_H;
  const per = Math.max(1, Math.floor(200 / W)) * Math.max(1, Math.floor(287 / H));

  return (
    <div className="pb-4">
      <div className="mb-3 overflow-hidden rounded-2xl bg-secondary p-3"><FoCanvas item={item} /></div>
      <p className="mb-3 text-center text-[11px] text-muted-foreground">ขนาดฉลาก {W} × {H} mm · ลง A4 ได้ {per} ดวง/แผ่น</p>

      <div className="mb-3 rounded-2xl bg-secondary px-4 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
        ลูกค้า: <b className="text-foreground">{item.customer_name || "-"}</b><br />
        สร้างเมื่อ {new Date(item.created_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
        {item.note ? <><br />หมายเหตุ: {item.note}</> : null}
      </div>

      <Field label="จำนวนดวงที่ต้องการปริ้น">
        <input value={copies} onChange={(e) => setCopies(e.target.value.replace(/\D/g, "").slice(0, 3))}
          inputMode="numeric" placeholder="1" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
      </Field>

      {err && <p className="mb-2 text-center text-xs text-destructive">{err}</p>}
      <Button onClick={() => onPdf("a4", Math.max(1, Number(copies) || 1))} disabled={busy !== null}
        className="w-full rounded-2xl py-6 text-[15px]">
        {busy === "a4" ? <><Loader2 size={16} className="animate-spin" /> กำลังสร้างไฟล์…</>
                       : <><Printer size={16} /> ไฟล์ PDF ลงกระดาษ A4 ({per} ดวง/แผ่น)</>}
      </Button>
      <button onClick={() => onPdf("label", Math.max(1, Number(copies) || 1))} disabled={busy !== null}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-3.5 text-sm font-bold text-foreground">
        {busy === "label" ? <><Loader2 size={15} className="animate-spin" /> กำลังสร้างไฟล์…</>
                          : <><Printer size={15} /> ไฟล์ PDF เครื่องพิมพ์สติกเกอร์ ({W}×{H}mm)</>}
      </button>
      <p className="mt-2 px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        เปิดไฟล์แล้วสั่งพิมพ์ <b className="text-foreground">มาตราส่วน 100%</b>
      </p>

      <button onClick={onEdit} className="mt-3 w-full rounded-2xl bg-secondary py-3 text-sm font-semibold text-foreground">แก้ไขข้อมูล</button>
      <DeleteButton onClick={onDelete} label="ลบฉลากนี้" />
    </div>
  );
}

/* ---------------- ฟอร์มสร้าง/แก้ไข ---------------- */
function FoForm({ initial, customers, onDone, onDelete }: {
  initial: FoLabel | null; customers: Customer[]; onDone: () => void; onDelete?: () => void;
}) {
  const [code, setCode] = useState(initial?.code || "");
  const [name, setName] = useState(initial?.name || "");
  const [gross, setGross] = useState(initial?.gross_min || "");
  const [tare, setTare] = useState(initial?.tare_min || "");
  const [net, setNet] = useState(initial?.net || "");
  const [mfg, setMfg] = useState(initial?.mfg_date || foToday());
  const [bbe, setBbe] = useState(initial?.bbe_date || plusTwoYears(foToday()));
  const [batch, setBatch] = useState(initial?.batch_of || "");
  const [signal, setSignal] = useState<"DANGER" | "WARNING">(initial?.signal_word || "DANGER");
  const [pics, setPics] = useState<string[]>(initial?.pictograms || []);
  const [hp, setHp] = useState(initial?.hp_codes ?? lastHp());
  const [storage, setStorage] = useState(initial?.storage_text ?? lastStorage());
  const [customerId, setCustomerId] = useState(initial?.customer_id || "");
  const [note, setNote] = useState(initial?.note || "");
  const [wmm, setWmm] = useState(String(initial?.width_mm ?? FO_W));
  const [hmm, setHmm] = useState(String(initial?.height_mm ?? FO_H));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function changeMfg(d: string) {
    const prevAuto = plusTwoYears(mfg);
    setMfg(d);
    if (!bbe || bbe === prevAuto) setBbe(plusTwoYears(d));
  }
  const togglePic = (c: string) =>
    setPics((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  async function save() {
    if (!code.trim()) { setErr("ต้องใส่ Code"); return; }
    if (!name.trim()) { setErr("ต้องใส่ Name"); return; }
    if (!gross.trim()) { setErr("ต้องใส่ Gross min"); return; }
    if (!tare.trim()) { setErr("ต้องใส่ Tare min"); return; }
    if (!net.trim()) { setErr("ต้องใส่ Net"); return; }
    if (!mfg) { setErr("ต้องเลือกวันผลิต (Manufactured)"); return; }
    if (!bbe) { setErr("ต้องมีวันหมดอายุ (BBE)"); return; }
    if (!batch.trim()) { setErr("ต้องใส่ Batch (OF)"); return; }
    const W = Number(wmm), H = Number(hmm);
    if (!W || !H || W < 20 || H < 20) { setErr("ขนาดฉลากต้องไม่ต่ำกว่า 20 mm"); return; }
    setErr(""); setBusy(true);

    const cust = customers.find((c) => c.id === customerId);
    const payload = {
      code: code.trim(), name: name.trim(),
      gross_min: gross.trim(), tare_min: tare.trim(), net: net.trim(),
      mfg_date: mfg, bbe_date: bbe, batch_of: batch.trim(),
      signal_word: signal, pictograms: pics,
      hp_codes: hp.trim() || null, storage_text: storage.trim() || null,
      customer_id: customerId || null, customer_name: cust?.name || null,
      note: note.trim() || null, width_mm: W, height_mm: H,
    };
    const { error } = initial
      ? await supabase.from("fo_labels").update(payload).eq("id", initial.id)
      : await supabase.from("fo_labels").insert(payload);
    if (error) { setErr(error.message); toast.error("บันทึกไม่สำเร็จ"); setBusy(false); return; }
    rememberLines(hp.trim(), storage.trim());
    await logAudit({ action: initial ? "update" : "create", entity: "fo-label", entityId: payload.batch_of, newValue: payload });
    toast.success(initial ? "แก้ไขแล้ว" : "สร้างฉลากแล้ว");
    onDone();
  }

  const ClearBtn = ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick} aria-label="ล้าง"
      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-muted-foreground">
      <X size={13} />
    </button>
  );

  const preview: FoLabel = {
    id: "", code: code.trim() || "—", name: name.trim() || "—",
    gross_min: gross.trim(), tare_min: tare.trim(), net: net.trim(),
    mfg_date: mfg, bbe_date: bbe, batch_of: batch.trim() || "—",
    signal_word: signal, pictograms: pics, hp_codes: hp, storage_text: storage,
    customer_id: null, customer_name: null, note: null,
    width_mm: Number(wmm) || FO_W, height_mm: Number(hmm) || FO_H, created_at: new Date().toISOString(),
  };

  return (
    <div className="pb-4">
      <Field label="Code *">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="NS11961543"
          className="w-full rounded-2xl px-4 py-3" style={{ ...inputStyle, fontFamily: mono }} />
      </Field>
      <Field label="Name * (ตัวใหญ่สุดบนฉลาก)">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="IRIS MUSK (SOLISSE)"
          className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
      </Field>

      <div className="grid grid-cols-3 gap-2 [&>*]:min-w-0">
        <Field label="Gross min *">
          <input value={gross} onChange={(e) => setGross(e.target.value)} placeholder="1kg116"
            className="box-border w-full rounded-2xl px-3 py-3 text-[13px]" style={{ ...inputStyle, fontFamily: mono }} />
        </Field>
        <Field label="Tare min *">
          <input value={tare} onChange={(e) => setTare(e.target.value)} placeholder="0kg116"
            className="box-border w-full rounded-2xl px-3 py-3 text-[13px]" style={{ ...inputStyle, fontFamily: mono }} />
        </Field>
        <Field label="Net *">
          <input value={net} onChange={(e) => setNet(e.target.value)} placeholder="1kg000"
            className="box-border w-full rounded-2xl px-3 py-3 text-[13px]" style={{ ...inputStyle, fontFamily: mono }} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
        <Field label="Manufactured *">
          <div className="relative min-w-0">
            <input type="date" value={mfg} onChange={(e) => changeMfg(e.target.value)}
              className="box-border w-full min-w-0 appearance-none rounded-2xl px-3 py-3 pr-8 text-[13px]" style={inputStyle} />
            {mfg && <ClearBtn onClick={() => setMfg("")} />}
          </div>
        </Field>
        <Field label="BBE *">
          <div className="relative min-w-0">
            <input type="date" value={bbe} onChange={(e) => setBbe(e.target.value)}
              className="box-border w-full min-w-0 appearance-none rounded-2xl px-3 py-3 pr-8 text-[13px]" style={inputStyle} />
            {bbe && <ClearBtn onClick={() => setBbe("")} />}
          </div>
        </Field>
      </div>
      <p className="-mt-1 mb-3 px-1 text-[11px] text-muted-foreground">BBE เติมให้อัตโนมัติ = วันผลิต + 2 ปี (แก้เองได้)</p>

      <Field label="Batch (OF) *">
        <input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="0F2613B0400"
          className="w-full rounded-2xl px-4 py-3" style={{ ...inputStyle, fontFamily: mono }} />
      </Field>
      <p className="-mt-1 mb-3 px-1 text-[11px] text-muted-foreground">เลขนี้จะถูกทำเป็น Data Matrix มุมซ้ายล่างของฉลาก</p>

      <Field label="คำสัญญาณ">
        <div className="flex gap-2">
          {(["DANGER", "WARNING"] as const).map((w) => (
            <button key={w} type="button" onClick={() => setSignal(w)}
              className="flex-1 rounded-2xl py-3 text-[13px] font-bold"
              style={signal === w ? { background: C.ink, color: "#fff" } : { background: C.bg, color: C.sub }}>
              {w}
            </button>
          ))}
        </div>
      </Field>

      <Field label="สัญลักษณ์อันตราย (เลือกได้หลายอัน)">
        <div className="grid grid-cols-3 gap-2">
          {GHS.map((g) => {
            const on = pics.includes(g.code);
            return (
              <button key={g.code} type="button" onClick={() => togglePic(g.code)}
                className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-center"
                style={on ? { background: C.brandSoft, border: `1.5px solid ${C.brand}` }
                          : { background: C.bg, border: "1.5px solid transparent" }}>
                <img src={ghsUrl(g.code)} alt="" style={{ width: 30, height: 30, objectFit: "contain" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                <span className="text-[10px] font-semibold leading-tight"
                  style={{ color: on ? C.brand : C.sub }}>{g.th}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="รหัส H/P (บรรทัดล่าง)">
        <textarea value={hp} onChange={(e) => setHp(e.target.value)} rows={2}
          className="w-full rounded-2xl px-4 py-3 text-[12px]" style={{ ...inputStyle, fontFamily: mono }} />
      </Field>
      <Field label="วิธีเก็บรักษา (บรรทัดล่างสุด)">
        <textarea value={storage} onChange={(e) => setStorage(e.target.value)} rows={2}
          className="w-full rounded-2xl px-4 py-3 text-[12px]" style={{ ...inputStyle, fontFamily: mono }} />
      </Field>
      <div className="-mt-1 mb-3 flex items-center gap-2 px-1">
        <p className="flex-1 text-[11px] text-muted-foreground">จำค่าที่กรอกล่าสุดไว้ให้ ใบถัดไปไม่ต้องพิมพ์ใหม่</p>
        {(hp !== DEFAULT_HP || storage !== DEFAULT_STORAGE) && (
          <button type="button" onClick={() => { setHp(DEFAULT_HP); setStorage(DEFAULT_STORAGE); }}
            className="shrink-0 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-foreground">
            ใช้ค่าตั้งต้น
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
        <Field label="กว้าง (mm)">
          <input value={wmm} onChange={(e) => setWmm(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal"
            className="box-border w-full rounded-2xl px-3 py-3 text-[13px]" style={inputStyle} />
        </Field>
        <Field label="สูง (mm)">
          <input value={hmm} onChange={(e) => setHmm(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal"
            className="box-border w-full rounded-2xl px-3 py-3 text-[13px]" style={inputStyle} />
        </Field>
      </div>
      <div className="-mt-1 mb-3 flex items-center gap-2 px-1">
        <p className="flex-1 text-[11px] text-muted-foreground">
          FO Label แนะนำ <b className="text-foreground">{FO_W} × {FO_H} mm</b> (ลง A4 ได้แผ่นละ 2 ดวง)
        </p>
        {(Number(wmm) !== FO_W || Number(hmm) !== FO_H) && (
          <button type="button" onClick={() => { setWmm(String(FO_W)); setHmm(String(FO_H)); }}
            className="shrink-0 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-foreground">
            ใช้ขนาดแนะนำ
          </button>
        )}
      </div>

      {code.trim() && name.trim() && batch.trim() && (
        <div className="mb-3 overflow-hidden rounded-2xl bg-secondary p-3">
          <p className="mb-2 text-center text-[11px] font-semibold text-muted-foreground">ตัวอย่างฉลาก</p>
          <FoCanvas item={preview} />
        </div>
      )}

      <Field label="ลูกค้า (ใช้ตอนย้อนดูว่าส่งให้ใคร)">
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
          className="w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
          <option value="">ยังไม่ระบุ</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="หมายเหตุ (ไม่ขึ้นบนฉลาก)">
        <input value={note} onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
      </Field>

      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">
        {busy ? "กำลังบันทึก…" : "บันทึก"}
      </Button>
      {onDelete && <DeleteButton onClick={onDelete} label="ลบฉลากนี้" />}
    </div>
  );
}
