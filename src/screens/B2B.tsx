import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, Truck, RotateCcw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, SHADOW_SM, disp, mono, baht, inputStyle, fmtDate } from "../lib/ui";
import { LineItemsEditor, type LineItem, itemsTotal } from "./LineItems";
import { Modal, DetailRow, DetailActions, DeleteButton } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type Customer = { id: string; name: string; contact: string | null; phone: string | null; credit_terms: string | null; note: string | null };
type Order = { id: string; customer_name: string | null; status: string; items: LineItem[]; total: number; created_at: string };
type Sample = { id: string; customer_name: string; item: string; sent_date: string | null; tracking: string | null; status: string };

const ORDER_STATUS: Record<string, [string, string, string]> = {
  pending: ["รอดำเนินการ", C.redSoft, C.red],
  shipped: ["ส่งแล้ว", C.bg, C.ink],
  paid: ["ชำระแล้ว", C.greenSoft, C.green],
  done: ["จบงาน", C.greenSoft, C.green],
  returned: ["คืนสินค้า", C.redSoft, C.red],
  claim: ["เคลม", C.redSoft, C.red],
  cancelled: ["ยกเลิก", C.bg, C.sub],
};

type ModalState =
  | { k: "custForm"; item: Customer | null }
  | { k: "custView"; item: Customer }
  | { k: "orderForm" }
  | { k: "orderView"; item: Order }
  | { k: "sampleForm" }
  | { k: "sampleView"; item: Sample }
  | null;

export default function B2B() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, o, s] = await Promise.all([
      supabase.from("customers").select("id,name,contact,phone,credit_terms,note").eq("kind", "b2b").order("name"),
      supabase.from("orders").select("id,customer_name,status,items,total,created_at").eq("kind", "b2b").order("created_at", { ascending: false }).limit(50),
      supabase.from("samples").select("id,customer_name,item,sent_date,tracking,status").order("created_at", { ascending: false }).limit(30),
    ]);
    setCustomers((c.data as Customer[]) || []);
    setOrders((o.data as Order[]) || []);
    setSamples((s.data as Sample[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); logAudit({ action: "view", entity: "screen", entityId: "b2b" }); }, [load]);
  useBackHandler(modal !== null, () => setModal(null));

  const close = () => setModal(null);
  const done = () => { setModal(null); load(); };

  async function delCustomer(c: Customer) {
    if (!confirm("ลบลูกค้ารายนี้?")) return;
    await supabase.from("customers").delete().eq("id", c.id);
    await logAudit({ action: "delete", entity: "customer", entityId: c.name });
    done();
  }
  async function setOrderStatus(o: Order, status: string) {
    await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", o.id);
    await logAudit({ action: "update", entity: "order", entityId: o.id, oldValue: o.status, newValue: status });
    setModal((m) => (m && m.k === "orderView" ? { k: "orderView", item: { ...m.item, status } } : m));
    load();
  }
  async function delOrder(o: Order) {
    if (!confirm("ลบออเดอร์นี้?")) return;
    await supabase.from("orders").delete().eq("id", o.id);
    await logAudit({ action: "delete", entity: "order", entityId: o.id });
    done();
  }
  async function setSampleStatus(s: Sample, status: string) {
    await supabase.from("samples").update({ status }).eq("id", s.id);
    await logAudit({ action: "update", entity: "sample", entityId: s.id, oldValue: s.status, newValue: status });
    setModal((m) => (m && m.k === "sampleView" ? { k: "sampleView", item: { ...m.item, status } } : m));
    load();
  }
  async function delSample(s: Sample) {
    if (!confirm("ลบรายการตัวอย่างนี้?")) return;
    await supabase.from("samples").delete().eq("id", s.id);
    await logAudit({ action: "delete", entity: "sample", entityId: s.id });
    done();
  }

  const Sect = ({ children, onAdd }: { children?: any; onAdd?: () => void }) => (
    <div className="mb-3 mt-6 flex items-center justify-between px-1">
      <span className="font-disp text-base font-bold text-foreground">{children}</span>
      {onAdd && (
        <button onClick={onAdd} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
          <Plus size={13} /> เพิ่ม
        </button>
      )}
    </div>
  );

  return (
    <div className="px-5 pb-32">
      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>
      ) : (
        <>
          <Sect onAdd={() => setModal({ k: "custForm", item: null })}>ลูกค้าค้าส่ง ({customers.length})</Sect>
          {customers.length === 0 && <Empty text="ยังไม่มีลูกค้า — กด เพิ่ม เพื่อสร้างรายแรก" />}
          {customers.map((c) => (
            <div key={c.id} onClick={() => setModal({ k: "custView", item: c })} className="mb-2.5 cursor-pointer rounded-3xl bg-card p-4 shadow-sm">
              <div className="font-disp text-base font-bold text-foreground">{c.name}</div>
              <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-muted-foreground">
                {c.contact && <span>ติดต่อ {c.contact}</span>}
                {c.phone && <span>{c.phone}</span>}
                {c.credit_terms && <span>เครดิต {c.credit_terms}</span>}
              </div>
            </div>
          ))}

          <Sect onAdd={() => setModal({ k: "orderForm" })}>ออเดอร์</Sect>
          {orders.length === 0 && <Empty text="ยังไม่มีออเดอร์" />}
          {orders.map((o) => {
            const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
            return (
              <div key={o.id} onClick={() => setModal({ k: "orderView", item: o })} className="mb-2.5 cursor-pointer rounded-3xl bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-disp text-[15px] font-bold text-foreground">{o.customer_name || "-"}</span>
                  <span className="font-disp text-[15px] font-extrabold text-foreground">{baht(o.total)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</span>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: st[1], color: st[2] }}>{st[0]}</span>
                </div>
              </div>
            );
          })}

          <Sect onAdd={() => setModal({ k: "sampleForm" })}>ตัวอย่างที่ส่งแล้ว · tracking</Sect>
          {samples.length === 0 && <Empty text="ยังไม่มีตัวอย่างที่ส่ง" />}
          {samples.map((s) => (
            <div key={s.id} onClick={() => setModal({ k: "sampleView", item: s })} className="mb-2.5 cursor-pointer rounded-3xl bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{s.customer_name}</span>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background: s.status === "ตอบรับแล้ว" ? C.greenSoft : s.status === "ปฏิเสธ" ? C.redSoft : C.bg, color: s.status === "ตอบรับแล้ว" ? C.green : s.status === "ปฏิเสธ" ? C.red : C.sub }}>
                  {s.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{s.item}</div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Truck size={13} /> {fmtDate(s.sent_date)}</span>
                {s.tracking && <span style={{ fontFamily: mono }}>{s.tracking}</span>}
              </div>
            </div>
          ))}

          <Sect>คืน / เคลม</Sect>
          {orders.filter((o) => o.status === "returned" || o.status === "claim").length === 0
            ? <Empty text="ไม่มีรายการคืน/เคลมเปิดอยู่" />
            : orders.filter((o) => o.status === "returned" || o.status === "claim").map((o) => (
              <div key={o.id} onClick={() => setModal({ k: "orderView", item: o })} className="mb-2 flex cursor-pointer items-center gap-3 rounded-2xl bg-card p-3.5 shadow-sm">
                <RotateCcw size={16} className="text-primary" />
                <span className="flex-1 text-[13px] font-semibold text-foreground">{o.customer_name}</span>
                <span className="text-xs font-bold text-primary">{ORDER_STATUS[o.status][0]}</span>
              </div>
            ))}
        </>
      )}

      {/* ---------- Popups ---------- */}
      <Modal open={modal?.k === "custForm"} onClose={close} title={modal?.k === "custForm" && modal.item ? "แก้ไขลูกค้า" : "เพิ่มลูกค้า B2B"}>
        {modal?.k === "custForm" && <CustomerFields initial={modal.item} onDone={done} onDelete={modal.item ? () => delCustomer(modal.item!) : undefined} />}
      </Modal>

      <Modal open={modal?.k === "custView"} onClose={close} title="รายละเอียดลูกค้า">
        {modal?.k === "custView" && (
          <div className="pb-2">
            <div className="mb-1 font-disp text-xl font-extrabold text-foreground">{modal.item.name}</div>
            <DetailRow label="ผู้ติดต่อ">{modal.item.contact || "-"}</DetailRow>
            <DetailRow label="เบอร์โทร">{modal.item.phone || "-"}</DetailRow>
            <DetailRow label="เครดิต">{modal.item.credit_terms || "-"}</DetailRow>
            <DetailRow label="โน้ต">{modal.item.note || "-"}</DetailRow>
            <DetailActions onEdit={() => setModal({ k: "custForm", item: modal.item })} />
          </div>
        )}
      </Modal>

      <Modal open={modal?.k === "orderForm"} onClose={close} title="สร้างออเดอร์ B2B">
        {modal?.k === "orderForm" && <OrderFields customers={customers} onDone={done} />}
      </Modal>

      <Modal open={modal?.k === "orderView"} onClose={close} title="รายละเอียดออเดอร์">
        {modal?.k === "orderView" && (
          <div className="pb-2">
            <div className="mb-1 font-disp text-xl font-extrabold text-foreground">{modal.item.customer_name}</div>
            <div className="mb-3 text-xs text-muted-foreground">{fmtDate(modal.item.created_at)}</div>
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
            <select value={modal.item.status} onChange={(e) => setOrderStatus(modal.item, e.target.value)}
              className="mt-1 w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
              {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
            </select>
            <DetailActions onDelete={() => delOrder(modal.item)} />
          </div>
        )}
      </Modal>

      <Modal open={modal?.k === "sampleForm"} onClose={close} title="บันทึกตัวอย่างที่ส่ง">
        {modal?.k === "sampleForm" && <SampleFields customers={customers} onDone={done} />}
      </Modal>

      <Modal open={modal?.k === "sampleView"} onClose={close} title="รายละเอียดตัวอย่าง">
        {modal?.k === "sampleView" && (
          <div className="pb-2">
            <div className="mb-1 font-disp text-xl font-extrabold text-foreground">{modal.item.customer_name}</div>
            <DetailRow label="รายการ">{modal.item.item}</DetailRow>
            <DetailRow label="วันที่ส่ง">{fmtDate(modal.item.sent_date)}</DetailRow>
            <DetailRow label="Tracking"><span style={{ fontFamily: mono }}>{modal.item.tracking || "-"}</span></DetailRow>
            <div className="mt-3 text-[13px] text-muted-foreground">สถานะ</div>
            <select value={modal.item.status} onChange={(e) => setSampleStatus(modal.item, e.target.value)}
              className="mt-1 w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
              <option>รอผล</option><option>ตอบรับแล้ว</option><option>ปฏิเสธ</option>
            </select>
            <DetailActions onDelete={() => delSample(modal.item)} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-1 py-3 text-[13px] text-muted-foreground">{text}</p>;
}

export function Field({ label, children }: { label: string; children?: any }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function CustomerFields({ initial, onDone, onDelete }: { initial: Customer | null; onDone: () => void; onDelete?: () => void }) {
  const [f, setF] = useState({ name: initial?.name || "", contact: initial?.contact || "", phone: initial?.phone || "", credit_terms: initial?.credit_terms || "", note: initial?.note || "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.name.trim()) { setErr("ต้องมีชื่อลูกค้า"); return; }
    setBusy(true);
    const payload = { ...f, name: f.name.trim(), kind: "b2b" };
    const { error } = initial
      ? await supabase.from("customers").update(payload).eq("id", initial.id)
      : await supabase.from("customers").insert(payload);
    if (error) { setErr(error.message); setBusy(false); return; }
    await logAudit({ action: initial ? "update" : "create", entity: "customer", entityId: f.name, newValue: payload });
    onDone();
  }

  return (
    <div className="pb-4">
      <Field label="ชื่อลูกค้า/บริษัท"><input value={f.name} onChange={(e) => set("name", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="ชื่อผู้ติดต่อ"><input value={f.contact} onChange={(e) => set("contact", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="เบอร์โทร"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="เครดิต (เช่น 30 วัน)"><input value={f.credit_terms} onChange={(e) => set("credit_terms", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="โน้ต"><input value={f.note} onChange={(e) => set("note", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
      {onDelete && <DeleteButton onClick={onDelete} label="ลบลูกค้ารายนี้" />}
    </div>
  );
}

function OrderFields({ customers, onDone }: { customers: Customer[]; onDone: () => void }) {
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!customer.trim()) { setErr("เลือก/พิมพ์ชื่อลูกค้าก่อน"); return; }
    if (items.length === 0) { setErr("เพิ่มสินค้าอย่างน้อย 1 รายการ"); return; }
    setBusy(true);
    const match = customers.find((c) => c.name === customer);
    const payload = { customer_id: match?.id ?? null, customer_name: customer, kind: "b2b", items, total: itemsTotal(items) };
    const { error } = await supabase.from("orders").insert(payload);
    if (error) { setErr(error.message); setBusy(false); return; }
    await logAudit({ action: "create", entity: "order", entityId: customer, newValue: { total: payload.total } });
    onDone();
  }

  return (
    <div className="pb-4">
      <Field label="ลูกค้า">
        <input list="b2b-customers" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="เลือกหรือพิมพ์ชื่อ" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
        <datalist id="b2b-customers">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      </Field>
      <LineItemsEditor items={items} onChange={setItems} />
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : `บันทึกออเดอร์ · ${baht(itemsTotal(items))}`}</Button>
    </div>
  );
}

function SampleFields({ customers, onDone }: { customers: Customer[]; onDone: () => void }) {
  const [f, setF] = useState({ customer_name: "", item: "", tracking: "", sent_date: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.customer_name.trim() || !f.item.trim()) { setErr("ใส่ชื่อลูกค้าและรายการตัวอย่าง"); return; }
    setBusy(true);
    const { error } = await supabase.from("samples").insert(f);
    if (error) { setErr(error.message); setBusy(false); return; }
    await logAudit({ action: "create", entity: "sample", entityId: f.customer_name, newValue: f });
    onDone();
  }

  return (
    <div className="pb-4">
      <Field label="ลูกค้า">
        <input list="b2b-customers2" value={f.customer_name} onChange={(e) => set("customer_name", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
        <datalist id="b2b-customers2">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      </Field>
      <Field label="รายการ (เช่น Bois d'Encre ×3)"><input value={f.item} onChange={(e) => set("item", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="วันที่ส่ง"><input type="date" value={f.sent_date} onChange={(e) => set("sent_date", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="เลข tracking"><input value={f.tracking} onChange={(e) => set("tracking", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
    </div>
  );
}
