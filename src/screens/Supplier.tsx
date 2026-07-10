import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, ArrowLeft, CalendarClock, FileText, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { C, SHADOW_SM, disp, mono, baht, inputStyle, fmtDate, daysUntil } from "../lib/ui";
import { LineItemsEditor, type LineItem, itemsTotal } from "./LineItems";
import { Field } from "./B2B";

type Supplier = { id: string; name: string; material: string | null; contact: string | null; phone: string | null; contract_end: string | null; note: string | null };
type PO = { id: string; number: string; supplier_name: string | null; items: LineItem[]; total: number; status: string; created_at: string };

const PO_STATUS: Record<string, [string, string, string]> = {
  open: ["เปิดอยู่", "#FDECEA", "#E5322A"],
  sent: ["ส่งให้ผู้ผลิตแล้ว", "#F1F2F4", "#111214"],
  received: ["รับของแล้ว", "#E7F5EE", "#16A45C"],
  cancelled: ["ยกเลิก", "#F1F2F4", "#8A8F98"],
};

export default function SupplierScreen() {
  const [view, setView] = useState<"main" | "supplier" | "po">("main");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [editSup, setEditSup] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, p] = await Promise.all([
      supabase.from("suppliers").select("id,name,material,contact,phone,contract_end,note").order("name"),
      supabase.from("purchase_orders").select("id,number,supplier_name,items,total,status,created_at").order("created_at", { ascending: false }).limit(30),
    ]);
    setSuppliers((s.data as Supplier[]) || []);
    setPos((p.data as PO[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); logAudit({ action: "view", entity: "screen", entityId: "supplier" }); }, [load]);

  if (view === "supplier") return <SupplierForm initial={editSup} onDone={() => { setEditSup(null); setView("main"); load(); }} />;
  if (view === "po") return <POForm suppliers={suppliers} onDone={() => { setView("main"); load(); }} />;

  async function setPOStatus(po: PO, status: string) {
    await supabase.from("purchase_orders").update({ status }).eq("id", po.id);
    await logAudit({ action: "update", entity: "po", entityId: po.number, oldValue: po.status, newValue: status });
    load();
  }

  return (
    <div className="px-5 pb-32">
      {loading ? (
        <div className="flex justify-center py-10" style={{ color: C.sub }}><Loader2 size={22} className="animate-spin" /></div>
      ) : (
        <>
          <div className="px-1 mb-3 mt-2 flex items-center justify-between">
            <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>ผู้ผลิต / วัตถุดิบ ({suppliers.length})</span>
            <button onClick={() => setView("supplier")} className="rounded-full flex items-center gap-1 px-3 py-1.5" style={{ background: C.ink, color: "#fff", fontSize: 12, fontWeight: 600 }}>
              <Plus size={13} /> เพิ่ม
            </button>
          </div>
          {suppliers.length === 0 && <p style={{ color: C.sub, fontSize: 13 }} className="px-1">ยังไม่มีผู้ผลิต</p>}
          {suppliers.map((s) => {
            const d = daysUntil(s.contract_end);
            return (
              <div key={s.id} onClick={() => { setEditSup(s); setView("supplier"); }}
                className="rounded-3xl p-4 mb-2.5" style={{ background: C.card, boxShadow: SHADOW_SM }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>{s.name}</span>
                  {d != null && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                      style={{ background: d <= 30 ? C.redSoft : C.greenSoft, color: d <= 30 ? C.red : C.green, fontSize: 11, fontWeight: 600 }}>
                      <CalendarClock size={11} /> {d < 0 ? "หมดอายุแล้ว" : `${d} วัน`}
                    </span>
                  )}
                </div>
                {s.material && <div style={{ color: C.sub, fontSize: 12 }} className="mt-1">{s.material}</div>}
                {s.contract_end && (
                  <div style={{ fontSize: 12, color: C.sub }} className="mt-2 pt-2" >สัญญาถึง {fmtDate(s.contract_end)}</div>
                )}
              </div>
            );
          })}

          <div className="px-1 mb-3 mt-6 flex items-center justify-between">
            <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>ใบสั่งซื้อ (PO)</span>
            <button onClick={() => setView("po")} className="rounded-full flex items-center gap-1 px-3 py-1.5" style={{ background: C.ink, color: "#fff", fontSize: 12, fontWeight: 600 }}>
              <Plus size={13} /> เปิด PO
            </button>
          </div>
          {pos.length === 0 && <p style={{ color: C.sub, fontSize: 13 }} className="px-1">ยังไม่มีใบสั่งซื้อ</p>}
          {pos.map((po) => {
            const st = PO_STATUS[po.status] || PO_STATUS.open;
            return (
              <div key={po.id} className="rounded-3xl p-4 mb-2.5" style={{ background: C.card, boxShadow: SHADOW_SM }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 13, color: C.ink }}><FileText size={13} /> {po.number}</span>
                  <span style={{ fontFamily: disp, fontSize: 15, fontWeight: 800, color: C.ink }}>{baht(po.total)}</span>
                </div>
                <div style={{ color: C.sub, fontSize: 12 }} className="mt-1">{po.supplier_name || "-"} · {fmtDate(po.created_at)}</div>
                <select value={po.status} onChange={(e) => setPOStatus(po, e.target.value)}
                  className="mt-2.5 rounded-xl px-3 py-2" style={{ background: st[1], color: st[2], border: "none", outline: "none", fontSize: 12, fontWeight: 700 }}>
                  {Object.entries(PO_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
                </select>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function SupplierForm({ initial, onDone }: { initial: Supplier | null; onDone: () => void }) {
  const [f, setF] = useState({
    name: initial?.name || "", material: initial?.material || "", contact: initial?.contact || "",
    phone: initial?.phone || "", contract_end: initial?.contract_end || "", note: initial?.note || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.name.trim()) { setErr("ต้องมีชื่อผู้ผลิต"); return; }
    setBusy(true);
    const payload = { ...f, name: f.name.trim(), contract_end: f.contract_end || null };
    const { error } = initial
      ? await supabase.from("suppliers").update(payload).eq("id", initial.id)
      : await supabase.from("suppliers").insert(payload);
    if (error) { setErr(error.message); setBusy(false); return; }
    await logAudit({ action: initial ? "update" : "create", entity: "supplier", entityId: f.name, newValue: payload });
    onDone();
  }
  async function remove() {
    if (!initial || !confirm("ลบผู้ผลิตรายนี้?")) return;
    await supabase.from("suppliers").delete().eq("id", initial.id);
    await logAudit({ action: "delete", entity: "supplier", entityId: initial.name });
    onDone();
  }

  return (
    <div className="px-5 pb-32">
      <button onClick={onDone} className="flex items-center gap-2 mt-2 mb-4" style={{ color: C.sub, fontSize: 14 }}>
        <ArrowLeft size={18} /> กลับ
      </button>
      <div style={{ fontFamily: disp, fontSize: 20, fontWeight: 800, color: C.ink }} className="mb-4">{initial ? "แก้ไขผู้ผลิต" : "เพิ่มผู้ผลิต"}</div>
      <Field label="ชื่อผู้ผลิต"><input value={f.name} onChange={(e) => set("name", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="วัตถุดิบ/สินค้า"><input value={f.material} onChange={(e) => set("material", e.target.value)} placeholder="เช่น หัวน้ำหอม / ขวดแก้ว" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="ผู้ติดต่อ"><input value={f.contact} onChange={(e) => set("contact", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="เบอร์โทร"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="วันหมดอายุสัญญา (ระบบจะแจ้งเตือนก่อนหมด)"><input type="date" value={f.contract_end} onChange={(e) => set("contract_end", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="โน้ต"><input value={f.note} onChange={(e) => set("note", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      {err && <p style={{ color: C.red, fontSize: 12 }} className="mb-2">{err}</p>}
      <button onClick={save} disabled={busy} className="w-full rounded-2xl py-4" style={{ background: C.red, color: "#fff", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
        {busy ? "กำลังบันทึก…" : "บันทึก"}
      </button>
      {initial && (
        <button onClick={remove} className="w-full rounded-2xl py-3 mt-3 flex items-center justify-center gap-2" style={{ background: C.redSoft, color: C.red, fontWeight: 600, fontSize: 14 }}>
          <Trash2 size={15} /> ลบผู้ผลิต
        </button>
      )}
    </div>
  );
}

function POForm({ suppliers, onDone }: { suppliers: Supplier[]; onDone: () => void }) {
  const [supplier, setSupplier] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!supplier.trim()) { setErr("เลือก/พิมพ์ชื่อผู้ผลิต"); return; }
    if (items.length === 0) { setErr("เพิ่มรายการอย่างน้อย 1 รายการ"); return; }
    setBusy(true);
    const match = suppliers.find((s) => s.name === supplier);
    const number = "PO-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + String(Date.now()).slice(-4);
    const { error } = await supabase.from("purchase_orders").insert({
      number, supplier_id: match?.id ?? null, supplier_name: supplier, items, total: itemsTotal(items),
    });
    if (error) { setErr(error.message); setBusy(false); return; }
    await logAudit({ action: "create", entity: "po", entityId: number, newValue: { supplier, total: itemsTotal(items) } });
    onDone();
  }

  return (
    <div className="px-5 pb-32">
      <button onClick={onDone} className="flex items-center gap-2 mt-2 mb-4" style={{ color: C.sub, fontSize: 14 }}>
        <ArrowLeft size={18} /> กลับ
      </button>
      <div style={{ fontFamily: disp, fontSize: 20, fontWeight: 800, color: C.ink }} className="mb-4">เปิดใบสั่งซื้อ (PO)</div>
      <Field label="ผู้ผลิต">
        <input list="po-suppliers" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="เลือกหรือพิมพ์ชื่อ" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
        <datalist id="po-suppliers">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
      </Field>
      <LineItemsEditor items={items} onChange={setItems} freeText />
      {err && <p style={{ color: C.red, fontSize: 12 }} className="mb-2">{err}</p>}
      <button onClick={save} disabled={busy} className="w-full rounded-2xl py-4 mt-2" style={{ background: C.red, color: "#fff", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
        {busy ? "กำลังบันทึก…" : `บันทึก PO · ${baht(itemsTotal(items))}`}
      </button>
    </div>
  );
}
