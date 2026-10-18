import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, Truck, RotateCcw, Building2, Pencil, Phone, ChevronRight, TrendingUp, FileText, FolderOpen } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, mono, baht, inputStyle, fmtDate } from "../lib/ui";
import { toast } from "../lib/toast";
import { LineItemsEditor, type LineItem, itemsTotal } from "./LineItems";
import { Modal, DetailRow, DetailActions, DeleteButton } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { ContactLine } from "@/components/ui/contact-line";
import { Field } from "@/components/ui/field";
import Documents from "./Documents";

type Customer = {
  id: string;
  /** ชื่อบริษัท (ชื่อจดทะเบียน) — ใช้จับคู่กับออเดอร์/ตัวอย่าง */
  name: string;
  /** ชื่อแบรนด์ (ชื่อที่เรียกกันจริง) */
  brand_name: string | null;
  phone: string | null;
  logo_url: string | null; address: string | null; tax_id: string | null; email: string | null;
};
type Order = { id: string; customer_id: string | null; customer_name: string | null; status: string; items: LineItem[]; total: number; created_at: string };
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
  | { k: "orderForm"; prefill?: string }
  | { k: "orderView"; item: Order }
  | { k: "sampleForm"; prefill?: string }
  | { k: "sampleView"; item: Sample }
  | { k: "custMonthly"; item: Customer }
  | null;

export default function B2B() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(true);
  // หน้าลูกค้ารายคน (ดีไซน์เดียวกับหน้าร้านฝากขายใน B2C)
  const [custId, setCustId] = useState<string | null>(() => sessionStorage.getItem("b2b_cust") || null);
  const [orderFilter, setOrderFilter] = useState<"all" | "pending" | "back">("all");
  const [docOpen, setDocOpen] = useState(false);
  useEffect(() => {
    if (custId) sessionStorage.setItem("b2b_cust", custId);
    else sessionStorage.removeItem("b2b_cust");
  }, [custId]);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, o, s] = await Promise.all([
      supabase.from("customers").select("id,name,brand_name,phone,logo_url,address,tax_id,email").eq("kind", "b2b").order("name"),
      supabase.from("orders").select("id,customer_id,customer_name,status,items,total,created_at").eq("kind", "b2b").order("created_at", { ascending: false }).limit(200),
      supabase.from("samples").select("id,customer_name,item,sent_date,tracking,status").order("created_at", { ascending: false }).limit(30),
    ]);
    setCustomers((c.data as Customer[]) || []);
    setOrders((o.data as Order[]) || []);
    setSamples((s.data as Sample[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); logAudit({ action: "view", entity: "screen", entityId: "b2b" }); }, [load]);
  useBackHandler(modal !== null || docOpen || custId !== null, () => {
    if (modal) setModal(null);
    else if (docOpen) setDocOpen(false);
    else setCustId(null);
  });

  const close = () => setModal(null);
  const done = () => { setModal(null); load(); };

  async function delCustomer(c: Customer) {
    if (!confirm("ลบลูกค้ารายนี้?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", c.id);
    if (error) { toast.error("ลบลูกค้าไม่สำเร็จ"); return; }
    await logAudit({ action: "delete", entity: "customer", entityId: c.name });
    toast.success("ลบลูกค้าแล้ว");
    setCustId(null);
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

  /* ---------- ป๊อปอัพทั้งหมด (ใช้ร่วมกันทั้งหน้ารายชื่อและหน้าลูกค้ารายคน) ---------- */
  const popups = () => (
    <>
  {/* ---------- Popups ---------- */}
  <Modal open={modal?.k === "custForm"} onClose={close} title={modal?.k === "custForm" && modal.item ? "แก้ไขลูกค้า" : "เพิ่มลูกค้า B2B"}>
    {modal?.k === "custForm" && <CustomerFields initial={modal.item} onDone={done} onDelete={modal.item ? () => delCustomer(modal.item!) : undefined} />}
  </Modal>


  <Modal open={modal?.k === "orderForm"} onClose={close} title="สร้างออเดอร์ B2B">
    {modal?.k === "orderForm" && <OrderFields customers={customers} defaultName={modal.prefill} onDone={done} />}
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
    {modal?.k === "sampleForm" && <SampleFields customers={customers} defaultName={modal.prefill} onDone={done} />}
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

      <Modal open={modal?.k === "custMonthly"} onClose={close}
        title={`ยอดสั่งซื้อเดือนนี้ · ${new Date().toLocaleDateString("th-TH", { month: "long", year: "numeric" })}`}>
        {modal?.k === "custMonthly" && (() => {
          const c = modal.item;
          const mStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
          const rows = orders.filter((o) => (o.customer_id ? o.customer_id === c.id : o.customer_name === c.name) && new Date(o.created_at) >= mStart);
          const sum = rows.reduce((a, o) => a + Number(o.total || 0), 0);
          return (
            <div className="pb-4">
              {rows.length === 0 && <p className="text-[13px] text-muted-foreground">ยังไม่มีออเดอร์เดือนนี้</p>}
              {rows.map((o) => (
                <div key={o.id} className="flex items-center justify-between border-b border-border py-2.5 text-[13px]">
                  <span className="text-foreground">{fmtDate(o.created_at)} · {(o.items || []).length} รายการ</span>
                  <span className="font-disp font-bold">{baht(o.total)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-3">
                <span className="font-disp font-bold">รวมเดือนนี้</span>
                <span className="font-disp text-lg font-extrabold text-primary">{baht(sum)}</span>
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );

  /* ===== หน้าลูกค้ารายคน — ดีไซน์เดียวกับหน้าร้านฝากขายใน B2C ===== */
  const cust = custId ? customers.find((c) => c.id === custId) : null;
  if (cust) {
    const mine = orders.filter((o) => (o.customer_id ? o.customer_id === cust.id : o.customer_name === cust.name));
    const mySamples = samples.filter((s) => s.customer_name === cust.name);
    const now = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthOrders = mine.filter((o) => new Date(o.created_at) >= mStart);
    const monthly = monthOrders.reduce((a, o) => a + Number(o.total || 0), 0);
    const total = mine.reduce((a, o) => a + Number(o.total || 0), 0);
    const monthLabel = now.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    const pending = mine.filter((o) => o.status === "pending");
    const back = mine.filter((o) => o.status === "returned" || o.status === "claim");
    const shownOrders = orderFilter === "pending" ? pending : orderFilter === "back" ? back : mine;

    // หน้าเอกสารของลูกค้ารายนี้ (คลังเดียวกับหน้า Office แค่กรองเฉพาะของเขา)
    if (docOpen) {
      return (
        <div className="px-5 pb-32">
          <div className="mb-4 mt-2 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-secondary">
              {cust.logo_url
                ? <img src={cust.logo_url} alt="" className="h-full w-full object-cover" />
                : <Building2 size={20} className="text-muted-foreground" />}
            </div>
            <div className="min-w-0">
              <div className="truncate font-disp text-xl font-extrabold text-foreground">Document</div>
              <div className="truncate text-[11px] text-muted-foreground">{cust.brand_name || cust.name}</div>
            </div>
          </div>
          <Documents customer={{ id: cust.id, name: cust.name, brand_name: cust.brand_name }} />
        </div>
      );
    }

    return (
      <div className="px-5 pb-32">
        {/* หัวลูกค้า — โลโก้ใหญ่โปร่ง + ข้อมูลด้านข้าง + ปุ่มแก้ไขมุมขวา */}
        <div className="relative mt-3 flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden">
            {cust.logo_url
              ? <img src={cust.logo_url} alt="" className="h-full w-full object-contain" />
              : <Building2 size={44} className="text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1 pr-10">
            <div className="font-disp text-lg font-extrabold text-foreground">{cust.brand_name || cust.name}</div>
            {cust.brand_name && <div className="mt-0.5 text-[11px] text-muted-foreground"><b className="text-foreground">ชื่อบริษัท</b> {cust.name}</div>}
            {cust.phone && (
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <b className="text-foreground">เบอร์โทร</b> {cust.phone}
                <a href={`tel:${cust.phone}`} className="flex h-6 w-6 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.1)] text-primary"><Phone size={12} /></a>
              </div>
            )}
          </div>
          <button onClick={() => setModal({ k: "custForm", item: cust })} aria-label="แก้ไข"
            className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
            <Pencil size={16} />
          </button>
        </div>

        {/* ข้อมูลติดต่อ — ซ่อนช่องที่ว่าง */}
        <div className="mt-5 space-y-3">
          {cust.address && <ContactLine label="ที่อยู่" value={cust.address} copy={cust.address} />}
          {cust.tax_id && <ContactLine label="เลขผู้เสียภาษี" value={cust.tax_id} copy={cust.tax_id} />}
          {cust.email && <ContactLine label="อีเมล" value={cust.email} copy={cust.email} />}
        </div>

        {/* ยอดสั่งซื้อ */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="text-[11px] text-muted-foreground">ยอดสั่งซื้อเดือนนี้</div>
            <div className="mt-1 font-disp text-[26px] font-extrabold leading-none text-foreground">{baht(monthly)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{monthLabel}</div>
            <button onClick={() => setModal({ k: "custMonthly", item: cust })}
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-foreground">
              ดูรายละเอียด <ChevronRight size={12} />
            </button>
          </Card>
          <Card className="flex flex-col justify-between p-4">
            <div>
              <div className="text-[11px] text-muted-foreground">ยอดสั่งซื้อรวมทั้งหมด</div>
              <div className="mt-1 font-disp text-[26px] font-extrabold leading-none text-primary">{baht(total)}</div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <TrendingUp size={13} className="text-green-600" /> ตั้งแต่เป็นลูกค้า
            </div>
          </Card>
        </div>

        {/* 3 ปุ่มกรองออเดอร์ */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {([["all", "ออเดอร์ทั้งหมด", mine.length], ["pending", "รอดำเนินการ", pending.length], ["back", "คืน/เคลม", back.length]] as const).map(([k, label, n]) => (
            <button key={k} onClick={() => setOrderFilter(k)}
              className="flex flex-col items-center gap-1 rounded-2xl p-3 shadow-sm"
              style={orderFilter === k ? { background: C.ink } : { background: C.card }}>
              <span className="font-disp text-xl font-extrabold" style={{ color: orderFilter === k ? "#fff" : C.ink }}>{n}</span>
              <span className="text-[11px]" style={{ color: orderFilter === k ? "rgba(255,255,255,.7)" : C.sub }}>{label}</span>
            </button>
          ))}
        </div>

        {/* สร้างออเดอร์ใหม่ */}
        <button onClick={() => setModal({ k: "orderForm", prefill: cust.name })}
          className="mt-4 flex w-full items-center justify-between rounded-2xl px-5 py-6 text-white shadow-sm" style={{ background: C.brand }}>
          <div className="flex items-center gap-3.5">
            <div className="shrink-0"><FileText size={28} strokeWidth={1.8} /></div>
            <div className="text-left">
              <div className="font-disp text-[17px] font-extrabold">สร้างออเดอร์ใหม่</div>
              <div className="text-[12.5px] text-white/80">บันทึกออเดอร์ของลูกค้ารายนี้</div>
            </div>
          </div>
          <Plus size={24} />
        </button>

        {/* เอกสารของแบรนด์ */}
        <button onClick={() => setDocOpen(true)}
          className="mt-3 flex w-full items-center justify-between rounded-2xl bg-card px-5 py-6 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="shrink-0"><FolderOpen size={28} strokeWidth={1.8} className="text-foreground" /></div>
            <div className="text-left">
              <div className="font-disp text-[17px] font-extrabold text-foreground">Document</div>
              <div className="text-[12.5px] text-muted-foreground">โลโก้ · Presentation · Marketing · Packaging</div>
            </div>
          </div>
          <ChevronRight size={20} className="text-muted-foreground" />
        </button>

        {/* รายการออเดอร์ */}
        <div className="mb-3 mt-6 px-1 font-disp text-base font-bold text-foreground">
          {orderFilter === "pending" ? "ออเดอร์ที่รอดำเนินการ" : orderFilter === "back" ? "รายการคืน / เคลม" : "ออเดอร์ทั้งหมด"} ({shownOrders.length})
        </div>
        {shownOrders.length === 0 && <Empty text="ยังไม่มีรายการ" />}
        {shownOrders.map((o) => {
          const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
          return (
            <div key={o.id} onClick={() => setModal({ k: "orderView", item: o })} className="mb-2.5 cursor-pointer rounded-3xl bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</span>
                <span className="font-disp text-[15px] font-extrabold text-foreground">{baht(o.total)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{(o.items || []).length} รายการ</span>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: st[1], color: st[2] }}>{st[0]}</span>
              </div>
            </div>
          );
        })}

        {/* ตัวอย่างที่ส่งให้ลูกค้ารายนี้ */}
        <div className="mb-3 mt-6 flex items-center justify-between px-1">
          <span className="font-disp text-base font-bold text-foreground">ตัวอย่างที่ส่งแล้ว ({mySamples.length})</span>
          <button onClick={() => setModal({ k: "sampleForm", prefill: cust.name })} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
            <Plus size={13} /> เพิ่ม
          </button>
        </div>
        {mySamples.length === 0 && <Empty text="ยังไม่มีตัวอย่างที่ส่งให้ลูกค้ารายนี้" />}
        {mySamples.map((s) => (
          <div key={s.id} onClick={() => setModal({ k: "sampleView", item: s })} className="mb-2.5 cursor-pointer rounded-3xl bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">{s.item}</span>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: s.status === "ตอบรับแล้ว" ? C.greenSoft : s.status === "ปฏิเสธ" ? C.redSoft : C.bg, color: s.status === "ตอบรับแล้ว" ? C.green : s.status === "ปฏิเสธ" ? C.red : C.sub }}>
                {s.status}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Truck size={13} /> {fmtDate(s.sent_date)}</span>
              {s.tracking && <span style={{ fontFamily: mono }}>{s.tracking}</span>}
            </div>
          </div>
        ))}

        {popups()}
      </div>
    );
  }

  return (
    <div className="px-5 pb-32">
      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>
      ) : (
        <>
          {/* ลูกค้าค้าส่ง — การ์ดรูปแบบเดียวกับร้านฝากขายใน B2C */}
          <div className="mb-3 mt-2 px-1 font-disp text-base font-bold text-foreground">ลูกค้าค้าส่ง ({customers.length})</div>
          <div className="grid grid-cols-2 gap-3">
            {customers.map((c) => (
              <Card key={c.id} onClick={() => { setOrderFilter("all"); setDocOpen(false); setCustId(c.id); }} className="cursor-pointer overflow-hidden p-0">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Building2 size={38} className="text-muted-foreground" /></div>
                  )}
                </div>
                <div className="px-3 py-3 text-center">
                  <div className="truncate font-disp text-[15px] font-extrabold text-foreground">{c.brand_name || c.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{c.brand_name ? c.name : "ไม่ได้ระบุแบรนด์"}</div>
                </div>
              </Card>
            ))}
            <button onClick={() => setModal({ k: "custForm", item: null })}
              className="flex min-h-[172px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-muted-foreground">
              <Plus size={22} /><span className="text-[13px] font-semibold">เพิ่มลูกค้า</span>
            </button>
          </div>

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

      {popups()}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-1 py-3 text-[13px] text-muted-foreground">{text}</p>;
}

function CustomerFields({ initial, onDone, onDelete }: { initial: Customer | null; onDone: () => void; onDelete?: () => void }) {
  const [f, setF] = useState({
    logo_url: initial?.logo_url || "", brand_name: initial?.brand_name || "", name: initial?.name || "",
    address: initial?.address || "", tax_id: initial?.tax_id || "", phone: initial?.phone || "", email: initial?.email || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const inp = (k: keyof typeof f, ph?: string) => (
    <input value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
  );

  async function save() {
    if (!f.name.trim()) { setErr("ต้องมีชื่อบริษัท"); return; }
    setBusy(true);
    const payload = { ...f, name: f.name.trim(), kind: "b2b" };
    const { error } = initial
      ? await supabase.from("customers").update(payload).eq("id", initial.id)
      : await supabase.from("customers").insert(payload);
    if (error) { setErr(error.message); toast.error("บันทึกลูกค้าไม่สำเร็จ"); setBusy(false); return; }
    await logAudit({ action: initial ? "update" : "create", entity: "customer", entityId: f.name, newValue: payload });
    toast.success(initial ? "แก้ไขลูกค้าแล้ว" : "เพิ่มลูกค้าแล้ว");
    onDone();
  }

  return (
    <div className="pb-4">
      <Field label="รูปภาพ"><ImageUpload value={f.logo_url} onChange={(url) => set("logo_url", url)} folder="customers" /></Field>
      <Field label="ชื่อแบรนด์">{inp("brand_name", "เช่น Sathorn Grand")}</Field>
      <Field label="ชื่อบริษัท">{inp("name", "เช่น บริษัท สาทร แกรนด์ จำกัด")}</Field>
      <Field label="ที่อยู่">{inp("address")}</Field>
      <Field label="เลขผู้เสียภาษี">{inp("tax_id")}</Field>
      <Field label="เบอร์ติดต่อ">{inp("phone")}</Field>
      <Field label="อีเมล">{inp("email")}</Field>
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
      {onDelete && <DeleteButton onClick={onDelete} label="ลบลูกค้ารายนี้" />}
    </div>
  );
}

function OrderFields({ customers, defaultName, onDone }: { customers: Customer[]; defaultName?: string; onDone: () => void }) {
  const [customer, setCustomer] = useState(defaultName || "");
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

function SampleFields({ customers, defaultName, onDone }: { customers: Customer[]; defaultName?: string; onDone: () => void }) {
  const [f, setF] = useState({ customer_name: defaultName || "", item: "", tracking: "", sent_date: new Date().toISOString().slice(0, 10) });
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
