import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, MapPin, Minus, TrendingUp, ArrowLeft, Store, Boxes, Globe, RefreshCcw, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, disp, inputStyle } from "../lib/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type Location = { id: string; name: string; kind: string };
type StockRow = { id: string; location_id: string; product_id: string; qty: number; sold: number; returned: number; products?: { name: string; sku: string } };
type Campaign = { id: string; name: string; channel: string | null; status: string };

const CHANNELS: { kind: string; label: string; sub: string; icon: LucideIcon }[] = [
  { kind: "consign", label: "Consignment", sub: "ฝากขาย · เช็คยอด/ของคืน", icon: RefreshCcw },
  { kind: "online", label: "Online", sub: "พร้อมขายออนไลน์", icon: Globe },
  { kind: "store", label: "Shop", sub: "หน้าร้าน", icon: Store },
  { kind: "warehouse", label: "Product Stock", sub: "คลังสินค้า", icon: Boxes },
];

export default function B2C() {
  const [channel, setChannel] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [campName, setCampName] = useState("");
  const [popup, setPopup] = useState<null | "loc" | "camp">(null);
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
  useBackHandler(popup !== null || channel !== null, () => {
    if (popup) setPopup(null); else { setChannel(null); setOpen(null); }
  });

  const locsOfKind = (kind: string) => locations.filter((l) => l.kind === kind);
  const itemsOf = (locId: string) => stock.filter((s) => s.location_id === locId);
  const totalOf = (locId: string) => itemsOf(locId).reduce((s, i) => s + i.qty, 0);
  const kindTotal = (kind: string) => locsOfKind(kind).reduce((sum, l) => sum + totalOf(l.id), 0);

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
  async function addLocation(kind: string) {
    if (!addName.trim()) return;
    await supabase.from("stock_locations").insert({ name: addName.trim(), kind });
    await logAudit({ action: "create", entity: "location", entityId: addName });
    setAddName(""); setPopup(null); load();
  }
  async function addCampaign() {
    if (!campName.trim()) return;
    await supabase.from("campaigns").insert({ name: campName.trim() });
    await logAudit({ action: "create", entity: "campaign", entityId: campName });
    setCampName(""); setPopup(null); load();
  }
  async function toggleCampaign(cp: Campaign) {
    await supabase.from("campaigns").update({ status: cp.status === "active" ? "done" : "active" }).eq("id", cp.id);
    load();
  }

  if (loading) return <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>;

  /* ---------- รายละเอียดช่องทางที่เลือก ---------- */
  if (channel) {
    const meta = CHANNELS.find((c) => c.kind === channel)!;
    const locs = locsOfKind(channel);
    return (
      <div className="px-5 pb-32">
        <div className="mt-2 mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/0.1)]">
            <meta.icon size={22} className="text-primary" />
          </div>
          <div>
            <div className="font-disp text-xl font-extrabold text-foreground">{meta.label}</div>
            <div className="text-xs text-muted-foreground">{meta.sub} · รวม {kindTotal(channel)} ชิ้น</div>
          </div>
        </div>

        {locs.length === 0 && <p className="px-1 text-[13px] text-muted-foreground">ยังไม่มีสาขา/จุดในช่องทางนี้ — เพิ่มด้านล่าง</p>}
        {locs.map((l) => {
          const rows = itemsOf(l.id);
          const isOpen = open === l.id;
          return (
            <Card key={l.id} className="mb-2.5 p-4">
              <div className="flex items-center justify-between" onClick={() => setOpen(isOpen ? null : l.id)}>
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MapPin size={15} className="text-primary" /> {l.name}
                </span>
                <span className="font-disp text-xl font-extrabold text-foreground">{totalOf(l.id)}</span>
              </div>
              {isOpen && (
                <div className="mt-3 border-t border-border pt-3">
                  {rows.length === 0 && <p className="mb-2 text-xs text-muted-foreground">ยังไม่มีสินค้าในจุดนี้</p>}
                  {rows.map((r) => (
                    <div key={r.id} className="mb-3">
                      <div className="flex items-center justify-between">
                        <span className="min-w-0 flex-1 text-[13px] font-semibold text-foreground">{r.products?.name}</span>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="secondary" className="h-7 w-7 rounded-lg" onClick={() => adjust(r, "qty", -1)}><Minus size={13} /></Button>
                          <span className="min-w-[26px] text-center font-disp font-bold">{r.qty}</span>
                          <Button size="icon" variant="secondary" className="h-7 w-7 rounded-lg" onClick={() => adjust(r, "qty", 1)}><Plus size={13} /></Button>
                        </div>
                      </div>
                      {l.kind === "consign" && (
                        <div className="mt-1.5 flex items-center gap-3 text-[11.5px] text-muted-foreground">
                          <span>ขายแล้ว {r.sold} <button onClick={() => adjust(r, "sold", 1)} className="font-bold text-green-600">+1</button></span>
                          <span>คืน {r.returned} <button onClick={() => adjust(r, "returned", 1)} className="font-bold text-primary">+1</button></span>
                          <span className="font-semibold text-green-600">ต้องเก็บเงิน {r.sold}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <select defaultValue="" onChange={(e) => { addProductTo(l.id, e.target.value); e.target.value = ""; }}
                    className="mt-1 w-full rounded-xl px-3 py-2.5 text-[13px]" style={inputStyle}>
                    <option value="" disabled>+ เพิ่มสินค้าเข้าจุดนี้…</option>
                    {products.filter((p) => !rows.some((r) => r.product_id === p.id)).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </Card>
          );
        })}

        <button onClick={() => { setAddName(""); setPopup("loc"); }} className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-bold text-white">
          <Plus size={16} /> เพิ่มจุด/สาขาใน {meta.label}
        </button>

        <Modal open={popup === "loc"} onClose={() => setPopup(null)} title={`เพิ่มจุดใน ${meta.label}`}>
          <div className="pb-4">
            <div className="mb-1 text-xs text-muted-foreground">ชื่อจุด/สาขา</div>
            <input autoFocus value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="เช่น Central Chidlom" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
            <Button onClick={() => addLocation(channel)} className="mt-3 w-full rounded-2xl py-6 text-[15px]">บันทึก</Button>
          </div>
        </Modal>
      </div>
    );
  }

  /* ---------- หน้าหลัก B2C: 4 ช่อง + การตลาด ---------- */
  return (
    <div className="px-5 pb-32">
      <div className="mb-3 mt-2 px-1 font-disp text-base font-bold text-foreground">ช่องทางขาย</div>
      <div className="grid grid-cols-2 gap-3">
        {CHANNELS.map((c) => (
          <Card key={c.kind} onClick={() => setChannel(c.kind)} className="cursor-pointer p-5">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-foreground">
                <c.icon size={22} />
              </div>
              <span className="font-disp text-2xl font-extrabold text-foreground">{kindTotal(c.kind)}</span>
            </div>
            <div className="mt-3 font-disp text-[15px] font-bold text-foreground">{c.label}</div>
            <div className="text-[11px] text-muted-foreground">{c.sub}</div>
          </Card>
        ))}
      </div>

      <div className="mb-3 mt-7 flex items-center justify-between px-1">
        <span className="font-disp text-base font-bold text-foreground">การตลาด · แคมเปญ</span>
        <button onClick={() => { setCampName(""); setPopup("camp"); }} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"><Plus size={13} /> เพิ่ม</button>
      </div>
      {campaigns.length === 0 && <p className="mb-2 px-1 text-[13px] text-muted-foreground">ยังไม่มีแคมเปญ</p>}
      {campaigns.map((cp) => (
        <Card key={cp.id} className="mb-2 flex items-center gap-3 p-3.5">
          <TrendingUp size={16} className={cp.status === "active" ? "text-green-600" : "text-muted-foreground"} />
          <span className="flex-1 text-[13px] font-semibold text-foreground">{cp.name}</span>
          <button onClick={() => toggleCampaign(cp)} className="rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: cp.status === "active" ? C.greenSoft : C.bg, color: cp.status === "active" ? C.green : C.sub }}>
            {cp.status === "active" ? "กำลังทำงาน" : "จบแล้ว"}
          </button>
        </Card>
      ))}
      <div className="mt-3 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
        <ChevronRight size={12} /> แตะการ์ดช่องทางเพื่อจัดการสต็อกในช่องทางนั้น
      </div>

      <Modal open={popup === "camp"} onClose={() => setPopup(null)} title="เพิ่มแคมเปญ">
        <div className="pb-4">
          <div className="mb-1 text-xs text-muted-foreground">ชื่อแคมเปญ</div>
          <input autoFocus value={campName} onChange={(e) => setCampName(e.target.value)} placeholder="เช่น โปรเดือนนี้" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
          <Button onClick={addCampaign} className="mt-3 w-full rounded-2xl py-6 text-[15px]">บันทึก</Button>
        </div>
      </Modal>
    </div>
  );
}
