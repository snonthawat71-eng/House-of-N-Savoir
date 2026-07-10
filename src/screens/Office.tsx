import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, FileText, Printer, Upload, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, SHADOW_SM, disp, mono, baht, inputStyle, fmtDate } from "../lib/ui";
import { LineItemsEditor, type LineItem, itemsTotal } from "./LineItems";
import { Field } from "./B2B";
import { Modal, DetailRow, DetailActions } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type Quote = { id: string; number: string; customer_name: string; items: LineItem[]; total: number; status: string; created_at: string };

const Q_STATUS: Record<string, [string, string, string]> = {
  draft: ["ฉบับร่าง", "#F1F2F4", "#8A8F98"],
  sent: ["ส่งแล้ว·รอตอบ", "#FDECEA", "#E5322A"],
  accepted: ["ตอบรับแล้ว", "#E7F5EE", "#16A45C"],
  expired: ["หมดอายุ", "#F1F2F4", "#8A8F98"],
};

type ModalState = { k: "quoteForm" } | { k: "quoteView"; item: Quote } | null;

export default function Office({ go, finance }: { go: (s: string) => void; finance: boolean }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [custTotal, setCustTotal] = useState(0);
  const [custNew, setCustNew] = useState(0);
  const [months, setMonths] = useState<{ label: string; total: number }[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const six = new Date(); six.setMonth(six.getMonth() - 5); six.setDate(1); six.setHours(0, 0, 0, 0);
    const [q, c1, c2, o] = await Promise.all([
      supabase.from("quotations").select("id,number,customer_name,items,total,status,created_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
      supabase.from("orders").select("total,created_at").gte("created_at", six.toISOString()).not("status", "in", "(cancelled,returned)"),
    ]);
    setQuotes((q.data as Quote[]) || []);
    setCustTotal(c1.count || 0);
    setCustNew(c2.count || 0);
    const buckets: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      buckets.push({ label: d.toLocaleDateString("th-TH", { month: "short" }), total: 0 });
    }
    ((o.data as any[]) || []).forEach((r) => {
      const d = new Date(r.created_at);
      const idx = 5 - (new Date().getMonth() - d.getMonth() + 12 * (new Date().getFullYear() - d.getFullYear()));
      if (idx >= 0 && idx < 6) buckets[idx].total += Number(r.total) || 0;
    });
    setMonths(buckets);
    setLoading(false);
  }, []);

  useEffect(() => { load(); logAudit({ action: "view", entity: "screen", entityId: "office" }); }, [load]);
  useBackHandler(modal !== null, () => setModal(null));

  const close = () => setModal(null);
  const done = () => { setModal(null); load(); };
  const max = Math.max(...months.map((m) => m.total), 1);

  async function setQuoteStatus(q: Quote, status: string) {
    await supabase.from("quotations").update({ status }).eq("id", q.id);
    await logAudit({ action: "update", entity: "quotation", entityId: q.number, oldValue: q.status, newValue: status });
    setModal((m) => (m && m.k === "quoteView" ? { k: "quoteView", item: { ...m.item, status } } : m));
    load();
  }
  async function delQuote(q: Quote) {
    if (!confirm("ลบใบเสนอราคานี้?")) return;
    await supabase.from("quotations").delete().eq("id", q.id);
    await logAudit({ action: "delete", entity: "quotation", entityId: q.number });
    done();
  }

  return (
    <div className="px-5 pb-32">
      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>
      ) : (
        <>
          <div className="mt-2 rounded-3xl bg-card p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">ยอดขายรวม 6 เดือน (จากออเดอร์)</div>
            <div className="mt-0.5 font-disp text-2xl font-extrabold text-foreground">
              {finance ? baht(months.reduce((s, m) => s + m.total, 0)) : "ซ่อน (เฉพาะผู้มีสิทธิ์การเงิน)"}
            </div>
            <div className="mt-3 flex items-end gap-2" style={{ height: 80 }}>
              {months.map((m) => (
                <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t-lg" style={{ height: Math.max(4, (m.total / max) * 64), background: m.total > 0 ? C.brand : C.line }} />
                  <span style={{ fontFamily: mono, fontSize: 9, color: C.sub }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-card p-4 shadow-sm">
              <div className="font-disp text-2xl font-extrabold text-foreground">{custTotal}</div>
              <div className="text-[11px] text-muted-foreground">ลูกค้าทั้งหมด (ชุดกลาง)</div>
            </div>
            <div className="rounded-3xl bg-card p-4 shadow-sm">
              <div className="font-disp text-2xl font-extrabold text-green-600">+{custNew}</div>
              <div className="text-[11px] text-muted-foreground">ใหม่เดือนนี้</div>
            </div>
          </div>

          <div onClick={() => go("import")} className="mt-3 flex cursor-pointer items-center justify-between rounded-3xl bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary"><Upload size={20} className="text-foreground" /></div>
              <div>
                <div className="font-disp text-[15px] font-bold text-foreground">นำเข้าจาก Excel/CSV</div>
                <div className="text-[11px] text-muted-foreground">อัปโหลดไฟล์สินค้า/ลูกค้าเข้าระบบ</div>
              </div>
            </div>
            <ChevronRight size={18} className="text-muted-foreground" />
          </div>

          <div className="mb-3 mt-6 flex items-center justify-between px-1">
            <span className="font-disp text-base font-bold text-foreground">ใบเสนอราคา</span>
            <button onClick={() => setModal({ k: "quoteForm" })} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"><Plus size={13} /> สร้าง</button>
          </div>
          {quotes.length === 0 && <p className="px-1 text-[13px] text-muted-foreground">ยังไม่มีใบเสนอราคา</p>}
          {quotes.map((q) => {
            const st = Q_STATUS[q.status] || Q_STATUS.draft;
            return (
              <div key={q.id} onClick={() => setModal({ k: "quoteView", item: q })} className="mb-2.5 cursor-pointer rounded-3xl bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-disp text-[15px] font-bold text-foreground">{q.customer_name}</span>
                  <span className="font-disp text-[15px] font-extrabold text-foreground">{baht(q.total)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground" style={{ fontFamily: mono }}>{q.number}</span>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: st[1], color: st[2] }}>{st[0]}</span>
                </div>
              </div>
            );
          })}
        </>
      )}

      <Modal open={modal?.k === "quoteForm"} onClose={close} title="สร้างใบเสนอราคา">
        {modal?.k === "quoteForm" && <QuoteFields onDone={done} />}
      </Modal>

      <Modal open={modal?.k === "quoteView"} onClose={close} title="รายละเอียดใบเสนอราคา">
        {modal?.k === "quoteView" && (
          <div className="pb-2">
            <div className="mb-1 font-disp text-xl font-extrabold text-foreground">{modal.item.customer_name}</div>
            <div className="mb-3 text-xs text-muted-foreground" style={{ fontFamily: mono }}>{modal.item.number} · {fmtDate(modal.item.created_at)}</div>
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
            <Button onClick={() => printQuote(modal.item)} className="w-full rounded-2xl bg-ink py-5 hover:bg-ink/90"><Printer size={16} /> พิมพ์ / บันทึกเป็น PDF</Button>
            <div className="mt-3 text-[13px] text-muted-foreground">เปลี่ยนสถานะ</div>
            <select value={modal.item.status} onChange={(e) => setQuoteStatus(modal.item, e.target.value)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
              {Object.entries(Q_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
            </select>
            <DetailActions onDelete={() => delQuote(modal.item)} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function printQuote(q: Quote) {
  logAudit({ action: "view", entity: "quotation-pdf", entityId: q.number });
  const rows = (q.items || []).map((i, n) =>
    `<tr><td>${n + 1}</td><td>${esc(i.name)}</td><td class="r">${i.qty}</td><td class="r">${money(i.price)}</td><td class="r">${money(i.qty * i.price)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${q.number}</title>
  <style>
    body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111214;margin:40px;font-size:13px}
    h1{font-size:20px;margin:0} .muted{color:#8A8F98} .r{text-align:right}
    table{width:100%;border-collapse:collapse;margin-top:24px}
    th,td{padding:8px 10px;border-bottom:1px solid #EAECEF;text-align:left}
    th{background:#F1F2F4;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
    .total{font-size:16px;font-weight:700}
    .head{display:flex;justify-content:space-between;align-items:flex-start}
    .logo{width:48px;height:48px;background:#111214;color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px}
  </style></head><body>
  <div class="head">
    <div><div class="logo">N</div><h1 style="margin-top:12px">HOUSE OF N SAVOIR</h1><div class="muted">ใบเสนอราคา / Quotation</div></div>
    <div style="text-align:right"><div><b>${q.number}</b></div><div class="muted">${new Date(q.created_at).toLocaleDateString("th-TH")}</div></div>
  </div>
  <p style="margin-top:24px">เรียน: <b>${esc(q.customer_name)}</b></p>
  <table><thead><tr><th>#</th><th>รายการ</th><th class="r">จำนวน</th><th class="r">ราคา/หน่วย</th><th class="r">รวม</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td colspan="4" class="r total">รวมทั้งสิ้น</td><td class="r total">${money(q.total)}</td></tr></tfoot></table>
  <p class="muted" style="margin-top:40px">ใบเสนอราคานี้มีอายุ 30 วันนับจากวันที่ออกเอกสาร</p>
  <script>window.print()</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}
const esc = (s: string) => String(s || "").replace(/</g, "&lt;");
const money = (n: number) => "฿" + Number(n || 0).toLocaleString("th-TH");

function QuoteFields({ onDone }: { onDone: () => void }) {
  const [customer, setCustomer] = useState("");
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.from("customers").select("id,name").order("name").then(({ data }) => setCustomers((data as any) || []));
  }, []);

  async function save() {
    if (!customer.trim()) { setErr("ใส่ชื่อลูกค้า"); return; }
    if (items.length === 0) { setErr("เพิ่มรายการสินค้า"); return; }
    setBusy(true);
    const number = "QT-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + String(Date.now()).slice(-4);
    const { error } = await supabase.from("quotations").insert({ number, customer_name: customer.trim(), items, total: itemsTotal(items) });
    if (error) { setErr(error.message); setBusy(false); return; }
    await logAudit({ action: "create", entity: "quotation", entityId: number, newValue: { customer, total: itemsTotal(items) } });
    onDone();
  }

  return (
    <div className="pb-4">
      <Field label="ลูกค้า">
        <input list="q-customers" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="เลือกหรือพิมพ์ชื่อ" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
        <datalist id="q-customers">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      </Field>
      <LineItemsEditor items={items} onChange={setItems} />
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]"><FileText size={16} /> {busy ? "กำลังบันทึก…" : `บันทึก · ${baht(itemsTotal(items))}`}</Button>
    </div>
  );
}
