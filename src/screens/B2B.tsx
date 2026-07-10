import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, ArrowLeft, Truck, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { C, SHADOW_SM, disp, mono, baht, inputStyle, fmtDate } from "../lib/ui";
import { LineItemsEditor, type LineItem, itemsTotal } from "./LineItems";

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

export default function B2B() {
  const [view, setView] = useState<"main" | "customer" | "order" | "sample">("main");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
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

  const Sect = ({ children, action }: { children?: any; action?: any }) => (
    <div className="px-1 mb-3 mt-6 flex items-center justify-between">
      <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>{children}</span>{action}
    </div>
  );
  const AddBtn = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="rounded-full flex items-center gap-1 px-3 py-1.5"
      style={{ background: C.ink, color: "#fff", fontSize: 12, fontWeight: 600 }}>
      <Plus size={13} /> เพิ่ม
    </button>
  );

  if (view === "customer") return <CustomerForm initial={editCustomer} onDone={() => { setEditCustomer(null); setView("main"); load(); }} />;
  if (view === "order") return <OrderForm customers={customers} onDone={() => { setView("main"); load(); }} />;
  if (view === "sample") return <SampleForm customers={customers} onDone={() => { setView("main"); load(); }} />;

  async function cycleOrderStatus(o: Order, status: string) {
    await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", o.id);
    await logAudit({ action: "update", entity: "order", entityId: o.id, oldValue: o.status, newValue: status });
    load();
  }
  async function cycleSampleStatus(s: Sample, status: string) {
    await supabase.from("samples").update({ status }).eq("id", s.id);
    await logAudit({ action: "update", entity: "sample", entityId: s.id, oldValue: s.status, newValue: status });
    load();
  }

  return (
    <div className="px-5 pb-32">
      {loading ? (
        <div className="flex justify-center py-10" style={{ color: C.sub }}><Loader2 size={22} className="animate-spin" /></div>
      ) : (
        <>
          <Sect action={<AddBtn onClick={() => setView("customer")} />}>ลูกค้าค้าส่ง ({customers.length})</Sect>
          {customers.length === 0 && <Empty text="ยังไม่มีลูกค้า — กด เพิ่ม เพื่อสร้างรายแรก" />}
          {customers.map((c) => (
            <div key={c.id} onClick={() => { setEditCustomer(c); setView("customer"); }}
              className="rounded-3xl p-4 mb-2.5" style={{ background: C.card, boxShadow: SHADOW_SM }}>
              <div style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>{c.name}</div>
              <div className="flex gap-4 mt-1.5 flex-wrap" style={{ fontSize: 12, color: C.sub }}>
                {c.contact && <span>ติดต่อ {c.contact}</span>}
                {c.phone && <span>{c.phone}</span>}
                {c.credit_terms && <span>เครดิต {c.credit_terms}</span>}
              </div>
            </div>
          ))}

          <Sect action={<AddBtn onClick={() => setView("order")} />}>ออเดอร์</Sect>
          {orders.length === 0 && <Empty text="ยังไม่มีออเดอร์" />}
          {orders.map((o) => {
            const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
            return (
              <div key={o.id} className="rounded-3xl p-4 mb-2.5" style={{ background: C.card, boxShadow: SHADOW_SM }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: C.ink }}>{o.customer_name || "-"}</span>
                  <span style={{ fontFamily: disp, fontSize: 15, fontWeight: 800, color: C.ink }}>{baht(o.total)}</span>
                </div>
                <div style={{ color: C.sub, fontSize: 12 }} className="mt-1">
                  {(o.items || []).map((i) => `${i.name}×${i.qty}`).join(" · ") || "-"} · {fmtDate(o.created_at)}
                </div>
                <select value={o.status} onChange={(e) => cycleOrderStatus(o, e.target.value)}
                  className="mt-2.5 rounded-xl px-3 py-2" style={{ background: st[1], color: st[2], border: "none", outline: "none", fontSize: 12, fontWeight: 700 }}>
                  {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
                </select>
              </div>
            );
          })}

          <Sect action={<AddBtn onClick={() => setView("sample")} />}>ตัวอย่างที่ส่งแล้ว · tracking</Sect>
          {samples.length === 0 && <Empty text="ยังไม่มีตัวอย่างที่ส่ง" />}
          {samples.map((s) => (
            <div key={s.id} className="rounded-3xl p-4 mb-2.5" style={{ background: C.card, boxShadow: SHADOW_SM }}>
              <div className="flex items-center justify-between">
                <span style={{ color: C.ink, fontWeight: 700, fontSize: 14 }}>{s.customer_name}</span>
                <select value={s.status} onChange={(e) => cycleSampleStatus(s, e.target.value)}
                  className="rounded-full px-2.5 py-1"
                  style={{
                    background: s.status === "ตอบรับแล้ว" ? C.greenSoft : s.status === "ปฏิเสธ" ? C.redSoft : C.bg,
                    color: s.status === "ตอบรับแล้ว" ? C.green : s.status === "ปฏิเสธ" ? C.red : C.sub,
                    border: "none", outline: "none", fontSize: 11, fontWeight: 600,
                  }}>
                  <option>รอผล</option><option>ตอบรับแล้ว</option><option>ปฏิเสธ</option>
                </select>
              </div>
              <div style={{ color: C.sub, fontSize: 12 }} className="mt-1">{s.item}</div>
              <div className="flex items-center gap-3 mt-2" style={{ fontSize: 12, color: C.sub }}>
                <span className="flex items-center gap-1"><Truck size={13} /> {fmtDate(s.sent_date)}</span>
                {s.tracking && <span style={{ fontFamily: mono }}>{s.tracking}</span>}
              </div>
            </div>
          ))}

          <Sect>คืน / เคลม</Sect>
          {orders.filter((o) => o.status === "returned" || o.status === "claim").length === 0
            ? <Empty text="ไม่มีรายการคืน/เคลมเปิดอยู่" />
            : orders.filter((o) => o.status === "returned" || o.status === "claim").map((o) => (
              <div key={o.id} className="rounded-2xl p-3.5 mb-2 flex items-center gap-3" style={{ background: C.card, boxShadow: SHADOW_SM }}>
                <RotateCcw size={16} style={{ color: C.red }} />
                <span style={{ color: C.ink, fontSize: 13, fontWeight: 600 }} className="flex-1">{o.customer_name}</span>
                <span style={{ color: C.red, fontSize: 12, fontWeight: 700 }}>{ORDER_STATUS[o.status][0]}</span>
              </div>
            ))}
        </>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ color: C.sub, fontSize: 13 }} className="px-1 py-3">{text}</p>;
}

function FormShell({ title, onBack, children }: { title: string; onBack: () => void; children?: any }) {
  return (
    <div className="px-5 pb-32">
      <button onClick={onBack} className="flex items-center gap-2 mt-2 mb-4" style={{ color: C.sub, fontSize: 14 }}>
        <ArrowLeft size={18} /> กลับ
      </button>
      <div style={{ fontFamily: disp, fontSize: 20, fontWeight: 800, color: C.ink }} className="mb-4">{title}</div>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children?: any }) {
  return (
    <div className="mb-3">
      <div style={{ color: C.sub, fontSize: 12 }} className="mb-1">{label}</div>
      {children}
    </div>
  );
}

function CustomerForm({ initial, onDone }: { initial: Customer | null; onDone: () => void }) {
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
  async function remove() {
    if (!initial || !confirm("ลบลูกค้ารายนี้?")) return;
    await supabase.from("customers").delete().eq("id", initial.id);
    await logAudit({ action: "delete", entity: "customer", entityId: initial.name });
    onDone();
  }

  return (
    <FormShell title={initial ? "แก้ไขลูกค้า" : "เพิ่มลูกค้า B2B"} onBack={onDone}>
      <Field label="ชื่อลูกค้า/บริษัท"><input value={f.name} onChange={(e) => set("name", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="ชื่อผู้ติดต่อ"><input value={f.contact} onChange={(e) => set("contact", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="เบอร์โทร"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="เครดิต (เช่น 30 วัน)"><input value={f.credit_terms} onChange={(e) => set("credit_terms", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="โน้ต"><input value={f.note} onChange={(e) => set("note", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      {err && <p style={{ color: C.red, fontSize: 12 }} className="mb-2">{err}</p>}
      <button onClick={save} disabled={busy} className="w-full rounded-2xl py-4" style={{ background: C.red, color: "#fff", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
        {busy ? "กำลังบันทึก…" : "บันทึก"}
      </button>
      {initial && (
        <button onClick={remove} className="w-full rounded-2xl py-3 mt-3 flex items-center justify-center gap-2" style={{ background: C.redSoft, color: C.red, fontWeight: 600, fontSize: 14 }}>
          <Trash2 size={15} /> ลบลูกค้า
        </button>
      )}
    </FormShell>
  );
}

function OrderForm({ customers, onDone }: { customers: Customer[]; onDone: () => void }) {
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
    <FormShell title="สร้างออเดอร์ B2B" onBack={onDone}>
      <Field label="ลูกค้า">
        <input list="b2b-customers" value={customer} onChange={(e) => setCustomer(e.target.value)}
          placeholder="เลือกหรือพิมพ์ชื่อ" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
        <datalist id="b2b-customers">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      </Field>
      <LineItemsEditor items={items} onChange={setItems} />
      {err && <p style={{ color: C.red, fontSize: 12 }} className="mb-2">{err}</p>}
      <button onClick={save} disabled={busy} className="w-full rounded-2xl py-4 mt-2" style={{ background: C.red, color: "#fff", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
        {busy ? "กำลังบันทึก…" : `บันทึกออเดอร์ · ${baht(itemsTotal(items))}`}
      </button>
    </FormShell>
  );
}

function SampleForm({ customers, onDone }: { customers: Customer[]; onDone: () => void }) {
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
    <FormShell title="บันทึกตัวอย่างที่ส่ง" onBack={onDone}>
      <Field label="ลูกค้า">
        <input list="b2b-customers2" value={f.customer_name} onChange={(e) => set("customer_name", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
        <datalist id="b2b-customers2">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      </Field>
      <Field label="รายการ (เช่น Bois d'Encre ×3)"><input value={f.item} onChange={(e) => set("item", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="วันที่ส่ง"><input type="date" value={f.sent_date} onChange={(e) => set("sent_date", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="เลข tracking"><input value={f.tracking} onChange={(e) => set("tracking", e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      {err && <p style={{ color: C.red, fontSize: 12 }} className="mb-2">{err}</p>}
      <button onClick={save} disabled={busy} className="w-full rounded-2xl py-4" style={{ background: C.red, color: "#fff", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
        {busy ? "กำลังบันทึก…" : "บันทึก"}
      </button>
    </FormShell>
  );
}
