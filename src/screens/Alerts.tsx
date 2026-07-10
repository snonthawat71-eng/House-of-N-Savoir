import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Boxes, Truck, FileText, CalendarClock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { C, SHADOW_SM, fmtDate, daysUntil } from "../lib/ui";

type Alert = { icon: any; title: string; body: string; tone: "red" | "green" | "ink" };

/** แจ้งเตือนจริง — คำนวณสดจากข้อมูลในระบบ */
export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const [low, sup, qt, smp, po] = await Promise.all([
        supabase.from("products_view").select("name,stock").lte("stock", 10).order("stock"),
        supabase.from("suppliers").select("name,contract_end").not("contract_end", "is", null).lte("contract_end", in30),
        supabase.from("quotations").select("number,customer_name").eq("status", "sent"),
        supabase.from("samples").select("customer_name,item,status").eq("status", "ตอบรับแล้ว").order("created_at", { ascending: false }).limit(5),
        supabase.from("orders").select("customer_name").eq("status", "pending"),
      ]);
      const list: Alert[] = [];
      ((sup.data as any[]) || []).forEach((s) => {
        const d = daysUntil(s.contract_end);
        list.push({ icon: CalendarClock, title: "สัญญาใกล้หมดอายุ", body: `${s.name} · ${d != null && d < 0 ? "หมดอายุแล้ว" : `เหลือ ${d} วัน`} (${fmtDate(s.contract_end)})`, tone: "red" });
      });
      ((low.data as any[]) || []).forEach((p) => {
        list.push({ icon: Boxes, title: "สต็อกใกล้หมด", body: `${p.name} เหลือ ${p.stock} ชิ้น`, tone: p.stock <= 5 ? "red" : "ink" });
      });
      ((po.data as any[]) || []).forEach((o) => {
        list.push({ icon: AlertTriangle, title: "ออเดอร์ค้างดำเนินการ", body: o.customer_name || "-", tone: "ink" });
      });
      ((qt.data as any[]) || []).forEach((q) => {
        list.push({ icon: FileText, title: "ใบเสนอราคารอตอบ", body: `${q.number} · ${q.customer_name}`, tone: "ink" });
      });
      ((smp.data as any[]) || []).forEach((s) => {
        list.push({ icon: Truck, title: "ตัวอย่างถูกตอบรับ", body: `${s.customer_name} ตอบรับ ${s.item}`, tone: "green" });
      });
      setAlerts(list);
      setLoading(false);
      logAudit({ action: "view", entity: "screen", entityId: "alerts" });
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-10" style={{ color: C.sub }}><Loader2 size={22} className="animate-spin" /></div>;

  return (
    <div className="px-5 pb-32">
      <p style={{ color: C.sub, fontSize: 13 }} className="mt-2 mb-3 px-1">
        แจ้งเตือนคำนวณสดจากข้อมูลจริง · เปิดแอปเมื่อไหร่ก็อัปเดตล่าสุด
      </p>
      {alerts.length === 0 && (
        <p style={{ color: C.sub, fontSize: 13 }} className="text-center py-10">ไม่มีเรื่องต้องเตือนตอนนี้ 🎉</p>
      )}
      {alerts.map((a, i) => {
        const tone = a.tone === "red" ? [C.redSoft, C.red] : a.tone === "green" ? [C.greenSoft, C.green] : [C.bg, C.ink];
        return (
          <div key={i} className="rounded-2xl p-4 mb-2 flex items-start gap-3" style={{ background: C.card, boxShadow: SHADOW_SM }}>
            <div className="rounded-xl flex items-center justify-center shrink-0" style={{ width: 38, height: 38, background: tone[0], color: tone[1] }}>
              <a.icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ color: C.ink, fontSize: 14, fontWeight: 700 }}>{a.title}</div>
              <div style={{ color: C.sub, fontSize: 12 }}>{a.body}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
