import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, MapPin, Minus, TrendingUp } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { C, SHADOW_SM, disp, inputStyle } from "../lib/ui";

type Location = { id: string; name: string; kind: string };
type StockRow = { id: string; location_id: string; product_id: string; qty: number; sold: number; returned: number; products?: { name: string; sku: string } };
type Campaign = { id: string; name: string; channel: string | null; status: string };

const KIND_TH: Record<string, string> = { store: "หน้าร้าน", warehouse: "คลัง", online: "ออนไลน์", consign: "ฝากขาย" };

export default function B2C() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [campName, setCampName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [l, s, p, cp] = await Promise.all([
      supabase.from("stock_locations").select("id,name,kind").order("created_at"),
      supabase.from("stock_items").select("id,location_id,product_id,qty,sold,returned, products(name,sku)"),
      supabase.from("products_view").select("id,name,sku").order("name"),
      supabase.from("campaigns").select("id,name,channel,status").order("created_at", { ascending: false }),
    ]);
    setLocations((l.data as Location[]) || []);
    setStock((s.data as any) || []);
    setProducts((p.data as any) || []);
    setCampaigns((cp.data as Campaign[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); logAudit({ action: "view", entity: "screen", entityId: "b2c" }); }, [load]);

  const itemsOf = (locId: string) => stock.filter((s) => s.location_id === locId);
  const totalOf = (locId: string) => itemsOf(locId).reduce((s, i) => s + i.qty, 0);

  async function adjust(row: StockRow, field: "qty" | "sold" | "returned", delta: number) {
    const val = Math.max(0, (row as any)[field] + delta);
    await supabase.from("stock_items").update({ [field]: val }).eq("id", row.id);
    await logAudit({ action: "update", entity: "stock", entityId: row.products?.sku, oldValue: { [field]: (row as any)[field] }, newValue: { [field]: val } });
    load();
  }

  async function addProductTo(locId: string, productId: string) {
    if (!productId) return;
    await supabase.from("stock_items").upsert({ location_id: locId, product_id: productId, qty: 0 }, { onConflict: "location_id,product_id" });
    load();
  }

  async function addLocation() {
    if (!addName.trim()) return;
    await supabase.from("stock_locations").insert({ name: addName.trim(), kind: addName.includes("ฝาก") ? "consign" : "store" });
    await logAudit({ action: "create", entity: "location", entityId: addName });
    setAddName(""); load();
  }

  async function addCampaign() {
    if (!campName.trim()) return;
    await supabase.from("campaigns").insert({ name: campName.trim() });
    await logAudit({ action: "create", entity: "campaign", entityId: campName });
    setCampName(""); load();
  }
  async function toggleCampaign(cp: Campaign) {
    const status = cp.status === "active" ? "done" : "active";
    await supabase.from("campaigns").update({ status }).eq("id", cp.id);
    load();
  }

  if (loading) return <div className="flex justify-center py-10" style={{ color: C.sub }}><Loader2 size={22} className="animate-spin" /></div>;

  return (
    <div className="px-5 pb-32">
      <div className="px-1 mb-3 mt-2" style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>สต็อกตามช่องทาง</div>
      {locations.map((l) => {
        const rows = itemsOf(l.id);
        const isOpen = open === l.id;
        return (
          <div key={l.id} className="rounded-3xl p-4 mb-2.5" style={{ background: C.card, boxShadow: SHADOW_SM }}>
            <div className="flex items-center justify-between" onClick={() => setOpen(isOpen ? null : l.id)}>
              <span className="flex items-center gap-2" style={{ color: C.ink, fontSize: 14, fontWeight: 600 }}>
                <MapPin size={15} style={{ color: C.red }} /> {l.name}
                <span style={{ color: C.sub, fontSize: 11 }}>· {KIND_TH[l.kind] || l.kind}</span>
              </span>
              <span style={{ fontFamily: disp, fontWeight: 800, fontSize: 20, color: C.ink }}>{totalOf(l.id)}</span>
            </div>
            {isOpen && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                {rows.length === 0 && <p style={{ color: C.sub, fontSize: 12 }} className="mb-2">ยังไม่มีสินค้าในช่องทางนี้</p>}
                {rows.map((r) => (
                  <div key={r.id} className="mb-3">
                    <div className="flex items-center justify-between">
                      <span style={{ color: C.ink, fontSize: 13, fontWeight: 600 }} className="flex-1 min-w-0">{r.products?.name}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => adjust(r, "qty", -1)} className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, background: C.bg }}><Minus size={13} /></button>
                        <span style={{ fontFamily: disp, fontWeight: 700, minWidth: 26, textAlign: "center" }}>{r.qty}</span>
                        <button onClick={() => adjust(r, "qty", 1)} className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, background: C.bg }}><Plus size={13} /></button>
                      </div>
                    </div>
                    {l.kind === "consign" && (
                      <div className="flex gap-3 mt-1.5 items-center" style={{ fontSize: 11.5, color: C.sub }}>
                        <span>ขายแล้ว {r.sold} <button onClick={() => adjust(r, "sold", 1)} style={{ color: C.green, fontWeight: 700 }}>+1</button></span>
                        <span>คืน {r.returned} <button onClick={() => adjust(r, "returned", 1)} style={{ color: C.red, fontWeight: 700 }}>+1</button></span>
                        <span style={{ color: C.green, fontWeight: 600 }}>ต้องเก็บเงิน {r.sold} ชิ้น</span>
                      </div>
                    )}
                  </div>
                ))}
                <select defaultValue="" onChange={(e) => { addProductTo(l.id, e.target.value); e.target.value = ""; }}
                  className="w-full rounded-xl px-3 py-2.5 mt-1" style={{ ...inputStyle, fontSize: 13 }}>
                  <option value="" disabled>+ เพิ่มสินค้าเข้าช่องทางนี้…</option>
                  {products.filter((p) => !rows.some((r) => r.product_id === p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex gap-2 mt-1">
        <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="เพิ่มช่องทางใหม่ เช่น ฝากขาย · สยาม" className="flex-1 rounded-2xl px-4 py-3" style={inputStyle} />
        <button onClick={addLocation} className="rounded-2xl px-4" style={{ background: C.ink, color: "#fff", fontWeight: 700, fontSize: 13 }}>เพิ่ม</button>
      </div>

      <div className="px-1 mb-3 mt-7" style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>การตลาด · แคมเปญ</div>
      {campaigns.length === 0 && <p style={{ color: C.sub, fontSize: 13 }} className="px-1 mb-2">ยังไม่มีแคมเปญ</p>}
      {campaigns.map((cp) => (
        <div key={cp.id} className="rounded-2xl p-3.5 mb-2 flex items-center gap-3" style={{ background: C.card, boxShadow: SHADOW_SM }}>
          <TrendingUp size={16} style={{ color: cp.status === "active" ? C.green : C.sub }} />
          <span className="flex-1" style={{ color: C.ink, fontSize: 13, fontWeight: 600 }}>{cp.name}</span>
          <button onClick={() => toggleCampaign(cp)} className="rounded-full px-2.5 py-1"
            style={{ background: cp.status === "active" ? C.greenSoft : C.bg, color: cp.status === "active" ? C.green : C.sub, fontSize: 11, fontWeight: 700 }}>
            {cp.status === "active" ? "กำลังทำงาน" : "จบแล้ว"}
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={campName} onChange={(e) => setCampName(e.target.value)} placeholder="เพิ่มแคมเปญใหม่…" className="flex-1 rounded-2xl px-4 py-3" style={inputStyle} />
        <button onClick={addCampaign} className="rounded-2xl px-4" style={{ background: C.ink, color: "#fff", fontWeight: 700, fontSize: 13 }}>เพิ่ม</button>
      </div>
    </div>
  );
}
