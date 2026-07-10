import { useEffect, useState } from "react";
import { Loader2, Lock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { C, SHADOW_SM, disp, baht } from "../lib/ui";

/** Dashboard ภาพรวม — ทุกคนเห็น (ตัวเลขการเงินซ่อนตามสิทธิ์) */
export default function Dashboard({ finance }: { finance: boolean }) {
  const [loading, setLoading] = useState(true);
  const [salesThis, setSalesThis] = useState(0);
  const [salesPrev, setSalesPrev] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [lowStock, setLowStock] = useState<{ name: string; stock: number }[]>([]);
  const [expiring, setExpiring] = useState(0);
  const [pendingQuotes, setPendingQuotes] = useState(0);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const m0 = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const mPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const [o1, o2, po, low, sup, qt] = await Promise.all([
        supabase.from("orders").select("total").gte("created_at", m0).not("status", "in", "(cancelled,returned)"),
        supabase.from("orders").select("total").gte("created_at", mPrev).lt("created_at", m0).not("status", "in", "(cancelled,returned)"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("products_view").select("name,stock").lte("stock", 10).order("stock"),
        supabase.from("suppliers").select("id", { count: "exact", head: true }).not("contract_end", "is", null).lte("contract_end", in30),
        supabase.from("quotations").select("id", { count: "exact", head: true }).eq("status", "sent"),
      ]);
      setSalesThis(((o1.data as any[]) || []).reduce((s, r) => s + Number(r.total || 0), 0));
      setSalesPrev(((o2.data as any[]) || []).reduce((s, r) => s + Number(r.total || 0), 0));
      setPendingOrders(po.count || 0);
      setLowStock((low.data as any[]) || []);
      setExpiring(sup.count || 0);
      setPendingQuotes(qt.count || 0);
      setLoading(false);
      logAudit({ action: "view", entity: "screen", entityId: "dashboard" });
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-10" style={{ color: C.sub }}><Loader2 size={22} className="animate-spin" /></div>;

  const diff = salesPrev > 0 ? Math.round(((salesThis - salesPrev) / salesPrev) * 100) : null;

  return (
    <div className="px-5 pb-32">
      {/* ยอดขายเดือนนี้ */}
      <div className="mt-3 mb-1" style={{ color: C.sub, fontSize: 13 }}>ยอดขายเดือนนี้ (จากออเดอร์)</div>
      <div style={{ fontFamily: disp, fontWeight: 800, fontSize: 40, letterSpacing: -1, color: C.ink, lineHeight: 1 }}>
        {finance ? baht(salesThis) : (
          <span className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ background: C.redSoft, color: C.red, fontSize: 16, fontWeight: 700 }}>
            <Lock size={15} /> ซ่อนตามสิทธิ์
          </span>
        )}
      </div>
      {finance && diff != null && (
        <div className="flex items-center gap-1 mt-2" style={{ color: diff >= 0 ? C.green : C.red, fontSize: 13, fontWeight: 600 }}>
          {diff >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />} {diff >= 0 ? "+" : ""}{diff}%
          <span style={{ color: C.sub, fontWeight: 400 }}>จากเดือนก่อน</span>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <Kpi label="ออเดอร์รอดำเนินการ" value={pendingOrders} red={pendingOrders > 0} sub="สถานะ pending" />
        <Kpi label="ใบเสนอราคารอตอบ" value={pendingQuotes} red={pendingQuotes > 0} sub="ส่งแล้ว·ยังไม่ตอบ" />
        <Kpi label="สต็อกใกล้หมด" value={lowStock.length} red={lowStock.length > 0} sub="เหลือ ≤ 10 ชิ้น" />
        <Kpi label="สัญญาใกล้หมดอายุ" value={expiring} red={expiring > 0} sub="ภายใน 30 วัน" />
      </div>

      {lowStock.length > 0 && (
        <>
          <div className="px-1 mb-3 mt-6" style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>สินค้าใกล้หมด</div>
          {lowStock.slice(0, 6).map((p) => (
            <div key={p.name} className="rounded-2xl px-4 py-3 mb-2 flex items-center justify-between" style={{ background: C.card, boxShadow: SHADOW_SM }}>
              <span style={{ color: C.ink, fontSize: 13, fontWeight: 600 }}>{p.name}</span>
              <span style={{ fontFamily: disp, fontWeight: 800, color: C.red }}>{p.stock}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, red }: { label: string; value: number; sub?: string; red?: boolean }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: C.card, boxShadow: SHADOW_SM }}>
      <div style={{ color: C.sub, fontSize: 11 }}>{label}</div>
      <div style={{ fontFamily: disp, fontWeight: 800, fontSize: 26, color: red ? C.red : C.ink }} className="mt-1">{value}</div>
      {sub && <div style={{ color: C.sub, fontSize: 11 }}>{sub}</div>}
    </div>
  );
}
