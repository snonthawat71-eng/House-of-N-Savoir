import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, ArrowLeft, FileText, Printer, Upload, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, SHADOW_SM, disp, mono, baht, inputStyle, fmtDate } from "../lib/ui";
import { LineItemsEditor, type LineItem, itemsTotal } from "./LineItems";
import { Field } from "./B2B";

type Quote = { id: string; number: string; customer_name: string; items: LineItem[]; total: number; status: string; created_at: string };

const Q_STATUS: Record<string, [string, string, string]> = {
  draft: ["ฉบับร่าง", "#F1F2F4", "#8A8F98"],
  sent: ["ส่งแล้ว·รอตอบ", "#FDECEA", "#E5322A"],
  accepted: ["ตอบรับแล้ว", "#E7F5EE", "#16A45C"],
  expired: ["หมดอายุ", "#F1F2F4", "#8A8F98"],
};

export default function Office({ go, finance }: { go: (s: string) => void; finance: boolean }) {
  const [view, setView] = useState<"main" | "quote">("main");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [custTotal, setCustTotal] = useState(0);
  const [custNew, setCustNew] = useState(0);
  const [months, setMonths] = useState<{ label: string; total: number }[]>([]);
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
    // รวมยอดขายรายเดือน 6 เดือน
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
  useBackHandler(view === "quote", () => setView("main"));

  if (view === "quote") return <QuoteForm onDone={() => { setView("main"); load(); }} />;

  const max = Math.max(...months.map((m) => m.total), 1);

  async function setQuoteStatus(q: Quote, status: string) {
    await supabase.from("quotations").update({ status }).eq("id", q.id);
    await logAudit({ action: "update", entity: "quotation", entityId: q.number, oldValue: q.status, newValue: status });
    load();
  }

  return (
    <div className="px-5 pb-32">
      {loading ? (
        <div className="flex justify-center py-10" style={{ color: C.sub }}><Loader2 size={22} className="animate-spin" /></div>
      ) : (
        <>
          {/* ยอดขาย 6 เดือน (จากออเดอร์จริง) */}
          <div className="rounded-3xl p-4 mt-2" style={{ background: C.card, boxShadow: SHADOW_SM }}>
            <div style={{ color: C.sub, fontSize: 12 }}>ยอดขายรวม 6 เดือน (จากออเดอร์)</div>
            <div style={{ fontFamily: disp, fontWeight: 800, fontSize: 24, color: C.ink }} className="mt-0.5">
              {finance ? baht(months.reduce((s, m) => s + m.total, 0)) : "ซ่อน (เฉพาะผู้มีสิทธิ์การเงิน)"}
            </div>
            <div className="flex items-end gap-2 mt-3" style={{ height: 80 }}>
              {months.map((m) => (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-lg" style={{ height: Math.max(4, (m.total / max) * 64), background: m.total > 0 ? C.red : C.line }} />
                  <span style={{ fontFamily: mono, fontSize: 9, color: C.sub }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ฐานลูกค้า */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="rounded-3xl p-4" style={{ background: C.card, boxShadow: SHADOW_SM }}>
              <div style={{ fontFamily: disp, fontWeight: 800, fontSize: 26, color: C.ink }}>{custTotal}</div>
              <div style={{ color: C.sub, fontSize: 11 }}>ลูกค้าทั้งหมด (ชุดกลาง)</div>
            </div>
            <div className="rounded-3xl p-4" style={{ background: C.card, boxShadow: SHADOW_SM }}>
              <div style={{ fontFamily: disp, fontWeight: 800, fontSize: 26, color: C.green }}>+{custNew}</div>
              <div style={{ color: C.sub, fontSize: 11 }}>ใหม่เดือนนี้</div>
            </div>
          </div>

          {/* นำเข้า Excel */}
          <div onClick={() => go("import")} className="rounded-3xl p-4 mt-3 flex items-center justify-between" style={{ background: C.card, boxShadow: SHADOW_SM }}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl flex items-center justify-center" style={{ width: 44, height: 44, background: C.bg }}>
                <Upload size={20} style={{ color: C.ink }} />
              </div>
              <div>
                <div style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: C.ink }}>นำเข้าจาก Excel/CSV</div>
                <div style={{ fontSize: 11, color: C.sub }}>อัปโหลดไฟล์สินค้า/ลูกค้าเข้าระบบ</div>
              </div>
            </div>
            <ChevronRight size={18} style={{ color: C.sub }} />
          </div>

          {/* ใบเสนอราคา */}
          <div className="px-1 mb-3 mt-6 flex items-center justify-between">
            <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>ใบเสนอราคา</span>
            <button onClick={() => setView("quote")} className="rounded-full flex items-center gap-1 px-3 py-1.5" style={{ background: C.ink, color: "#fff", fontSize: 12, fontWeight: 600 }}>
              <Plus size={13} /> สร้าง
            </button>
          </div>
          {quotes.length === 0 && <p style={{ color: C.sub, fontSize: 13 }} className="px-1">ยังไม่มีใบเสนอราคา</p>}
          {quotes.map((q) => {
            const st = Q_STATUS[q.status] || Q_STATUS.draft;
            return (
              <div key={q.id} className="rounded-3xl p-4 mb-2.5" style={{ background: C.card, boxShadow: SHADOW_SM }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: C.ink }}>{q.customer_name}</span>
                  <span style={{ fontFamily: disp, fontSize: 15, fontWeight: 800, color: C.ink }}>{baht(q.total)}</span>
                </div>
                <div style={{ color: C.sub, fontSize: 12 }} className="mt-1">
                  <span style={{ fontFamily: mono }}>{q.number}</span> · {fmtDate(q.created_at)}
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <select value={q.status} onChange={(e) => setQuoteStatus(q, e.target.value)}
                    className="rounded-xl px-3 py-2" style={{ background: st[1], color: st[2], border: "none", outline: "none", fontSize: 12, fontWeight: 700 }}>
                    {Object.entries(Q_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
                  </select>
                  <button onClick={() => printQuote(q)} className="rounded-xl px-3 py-2 flex items-center gap-1.5" style={{ background: C.ink, color: "#fff", fontSize: 12, fontWeight: 600 }}>
                    <Printer size={13} /> PDF
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* พิมพ์ใบเสนอราคาเป็น PDF (เปิดหน้าพิมพ์ → Save as PDF) */
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

function QuoteForm({ onDone }: { onDone: () => void }) {
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
    <div className="px-5 pb-32">
      <div style={{ fontFamily: disp, fontSize: 20, fontWeight: 800, color: C.ink }} className="mt-2 mb-4">สร้างใบเสนอราคา</div>
      <Field label="ลูกค้า">
        <input list="q-customers" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="เลือกหรือพิมพ์ชื่อ" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
        <datalist id="q-customers">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      </Field>
      <LineItemsEditor items={items} onChange={setItems} />
      {err && <p style={{ color: C.red, fontSize: 12 }} className="mb-2">{err}</p>}
      <button onClick={save} disabled={busy} className="w-full rounded-2xl py-4 mt-2 flex items-center justify-center gap-2" style={{ background: C.red, color: "#fff", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
        <FileText size={16} /> {busy ? "กำลังบันทึก…" : `บันทึกใบเสนอราคา · ${baht(itemsTotal(items))}`}
      </button>
    </div>
  );
}
