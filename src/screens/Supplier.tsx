import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, CalendarClock, FileText } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, disp, mono, baht, inputStyle, fmtDate, daysUntil } from "../lib/ui";
import { LineItemsEditor, type LineItem, itemsTotal } from "./LineItems";
import { Field } from "./B2B";
import { Modal, DetailRow, DetailActions } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type Supplier = { id: string; name: string; material: string | null; contact: string | null; phone: string | null; contract_end: string | null; note: string | null };
type PO = { id: string; number: string; supplier_name: string | null; items: LineItem[]; total: number; status: string; created_at: string };

const PO_STATUS: Record<string, [string, string, string]> = {
  open: ["เปิดอยู่", "#FDECEA", "#E5322A"],
  sent: ["ส่งให้ผู้ผลิตแล้ว", "#F1F2F4", "#111214"],
  received: ["รับของแล้ว", "#E7F5EE", "#16A45C"],
  cancelled: ["ยกเลิก", "#F1F2F4", "#8A8F98"],
};

type ModalState =
  | { k: "supForm"; item: Supplier | null }
  | { k: "supView"; item: Supplier }
  | { k: "poForm" }
  | { k: "poView"; item: PO }
  | null;

export default function SupplierScreen() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
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
  useBackHandler(modal !== null, () => setModal(null));

  const close = () => setModal(null);
  const done = () => { setModal(null); load(); };

  async function delSupplier(s: Supplier) {
    if (!confirm("ลบผู้ผลิตรายนี้?")) return;
    await supabase.from("suppliers").delete().eq("id", s.id);
    await logAudit({ action: "delete", entity: "supplier", entityId: s.name });
    done();
  }
  async function setPOStatus(po: PO, status: string) {
    await supabase.from("purchase_orders").update({ status }).eq("id", po.id);
    await logAudit({ action: "update", entity: "po", entityId: po.number, oldValue: po.status, newValue: status });
    setModal((m) => (m && m.k === "poView" ? { k: "poView", item: { ...m.item, status } } : m));
    load();
  }
  async function delPO(po: PO) {
    if (!confirm("ลบใบสั่งซื้อนี้?")) return;
    await supabase.from("purchase_orders").delete().eq("id", po.id);
    await logAudit({ action: "delete", entity: "po", entityId: po.number });
    done();
  }

  return (
    <div className="px-5 pb-32">
      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>
      ) : (
        <>
          <div className="mb-3 mt-2 flex items-center justify-between px-1">
            <span className="font-disp text-base font-bold text-foreground">ผู้ผลิต / วัตถุดิบ ({suppliers.length})</span>
            <button onClick={() => setModal({ k: "supForm", item: null })} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"><Plus size={13} /> เพิ่ม</button>
          </div>
          {suppliers.length === 0 && <p className="px-1 text-[13px] text-muted-foreground">ยังไม่มีผู้ผลิต</p>}
          {suppliers.map((s) => {
            const d = daysUntil(s.contract_end);
            return (
              <div key={s.id} onClick={() => setModal({ k: "supView", item: s })} className="mb-2.5 cursor-pointer rounded-3xl bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-disp text-base font-bold text-foreground">{s.name}</span>
                  {d != null && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: d <= 30 ? C.redSoft : C.greenSoft, color: d <= 30 ? C.red : C.green }}>
                      <CalendarClock size={11} /> {d < 0 ? "หมดอายุแล้ว" : `${d} วัน`}
                    </span>
                  )}
                </div>
                {s.material && <div className="mt-1 text-xs text-muted-foreground">{s.material}</div>}
              </div>
            );
          })}

          <div className="mb-3 mt-6 flex items-center justify-between px-1">
            <span className="font-disp text-base font-bold text-foreground">ใบสั่งซื้อ (PO)</span>
            <button onClick={() => setModal({ k: "poForm" })} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"><Plus size={13} /> เปิด PO</button>
          </div>
          {pos.length === 0 && <p className="px-1 text-[13px] text-muted-foreground">ยังไม่มีใบสั่งซื้อ</p>}
          {pos.map((po) => {
            const st = PO_STATUS[po.status] || PO_STATUS.open;
            return (
              <div key={po.id} onClick={() => setModal({ k: "poView", item: po })} className="mb-2.5 cursor-pointer rounded-3xl bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[13px] text-foreground" style={{ fontFamily: mono }}><FileText size={13} /> {po.number}</span>
                  <span className="font-disp text-[15px] font-extrabold text-foreground">{baht(po.total)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{po.supplier_name || "-"} · {fmtDate(po.created_at)}</span>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: st[1], color: st[2] }}>{st[0]}</span>
                </div>
              </div>
            );
          })}
        </>
      )}

      <Modal open={modal?.k === "supForm"} onClose={close} title={modal?.k === "supForm" && modal.item ? "แก้ไขผู้ผลิต" : "เพิ่มผู้ผลิต"}>
        {modal?.k === "supForm" && <SupplierFields initial={modal.item} onDone={done} />}
      </Modal>

      <Modal open={modal?.k === "supView"} onClose={close} title="รายละเอียดผู้ผลิต">
        {modal?.k === "supView" && (
          <div className="pb-2">
            <div className="mb-1 font-disp text-xl font-extrabold text-foreground">{modal.item.name}</div>
            <DetailRow label="วัตถุดิบ/สินค้า">{modal.item.material || "-"}</DetailRow>
            <DetailRow label="ผู้ติดต่อ">{modal.item.contact || "-"}</DetailRow>
            <DetailRow label="เบอร์โทร">{modal.item.phone || "-"}</DetailRow>
            <DetailRow label="สัญญาถึง">{fmtDate(modal.item.contract_end)}</DetailRow>
            <DetailRow label="โน้ต">{modal.item.note || "-"}</DetailRow>
            <DetailActions onEdit={() => setModal({ k: "supForm", item: modal.item })} onDelete={() => delSupplier(modal.item)} />
          </div>
        )}
      </Modal>

      <Modal open={modal?.k === "poForm"} onClose={close} title="เปิดใบสั่งซื้อ (PO)">
        {modal?.k === "poForm" && <POFields suppliers={suppliers} onDone={done} />}
      </Modal>

      <Modal open={modal?.k === "poView"} onClose={close} title="รายละเอียด PO">
        {modal?.k === "poView" && (
          <div className="pb-2">
            <div className="mb-1 font-disp text-xl font-extrabold text-foreground" style={{ fontFamily: mono }}>{modal.item.number}</div>
            <div className="mb-3 text-xs text-muted-foreground">{modal.item.supplier_name} · {fmtDate(modal.item.created_at)}</div>
            {(modal.item.items || []).map((i, n) => (
              <div key={n} className="flex items-center justify-between border-b border-border py-2 text-[13px]">
                <span className="text-foreground">{i.name} ×{i.qty}</span>
                <span className="font-disp font-bold">{baht(i.qty * i.price)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-3">
              <span className="font-disp font-bold text-foreground">รวม</span>
              <span className="font-disp text-lg font-extrabold text-foreground">{baht(modal.item.total)}</span>
            </div>
            <div className="text-[13px] text-muted-foreground">เปลี่ยนสถานะ</div>
            <select value={modal.item.status} onChange={(e) => setPOStatus(modal.item, e.target.value)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
              {Object.entries(PO_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
            </select>
            <DetailActions onDelete={() => delPO(modal.item)} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function SupplierFields({ initial, onDone }: { initial: Supplier | null; onDone: () => void }) {
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

  return (
    <div className="pb-4">
      <Field label="ชื่อผู้ผลิต"><input value={f.name} onChange={(e) => set("name", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="วัตถุดิบ/สินค้า"><input value={f.material} onChange={(e) => set("material", e.target.value)} placeholder="เช่น หัวน้ำหอม / ขวดแก้ว" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="ผู้ติดต่อ"><input value={f.contact} onChange={(e) => set("contact", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="เบอร์โทร"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="วันหมดอายุสัญญา (แจ้งเตือนก่อนหมด)"><input type="date" value={f.contract_end} onChange={(e) => set("contract_end", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="โน้ต"><input value={f.note} onChange={(e) => set("note", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      {err && <p className="mb-2 text-xs text-primary">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
    </div>
  );
}

function POFields({ suppliers, onDone }: { suppliers: Supplier[]; onDone: () => void }) {
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
    const { error } = await supabase.from("purchase_orders").insert({ number, supplier_id: match?.id ?? null, supplier_name: supplier, items, total: itemsTotal(items) });
    if (error) { setErr(error.message); setBusy(false); return; }
    await logAudit({ action: "create", entity: "po", entityId: number, newValue: { supplier, total: itemsTotal(items) } });
    onDone();
  }

  return (
    <div className="pb-4">
      <Field label="ผู้ผลิต">
        <input list="po-suppliers" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="เลือกหรือพิมพ์ชื่อ" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
        <datalist id="po-suppliers">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
      </Field>
      <LineItemsEditor items={items} onChange={setItems} freeText />
      {err && <p className="mb-2 text-xs text-primary">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : `บันทึก PO · ${baht(itemsTotal(items))}`}</Button>
    </div>
  );
}
