import { useEffect, useState, useCallback } from "react";
import {
  Plus, Loader2, MapPin, Minus, TrendingUp, Store, Boxes, Globe, RefreshCcw,
  ChevronRight, Copy, Phone, Check, ChevronLeft, Store as StoreIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, disp, mono, baht, inputStyle } from "../lib/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field } from "./B2B";

type Location = {
  id: string; name: string; kind: string; updated_at?: string;
  shop_name?: string | null; branch_code?: string | null; branch_name?: string | null;
  address?: string | null; tax_id?: string | null; phone?: string | null; email?: string | null; logo_url?: string | null;
};
type StockRow = { id: string; location_id: string; product_id: string; qty: number; sold: number; returned: number; products?: { name: string; sku: string } };
type Sale = { id: string; product_name: string | null; qty: number; amount: number; sold_at: string };
type Campaign = { id: string; name: string; channel: string | null; status: string };

const CHANNELS: { kind: string; label: string; sub: string; icon: LucideIcon }[] = [
  { kind: "consign", label: "Consignment", sub: "ฝากขาย · เช็คยอด/ของคืน", icon: RefreshCcw },
  { kind: "online", label: "Online", sub: "พร้อมขายออนไลน์", icon: Globe },
  { kind: "store", label: "Shop", sub: "หน้าร้าน", icon: Store },
  { kind: "warehouse", label: "Product Stock", sub: "คลังสินค้า", icon: Boxes },
];

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  if (!text) return null;
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}
      className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
      {ok ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
    </button>
  );
}

export default function B2C() {
  const [channel, setChannel] = useState<string | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; retail: number | null }[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [popup, setPopup] = useState<null | "camp" | "shopForm" | "loc" | "monthly">(null);
  const [editShop, setEditShop] = useState<Location | null>(null);
  const [addName, setAddName] = useState("");
  const [campName, setCampName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [l, s, p, cp] = await Promise.all([
      supabase.from("stock_locations").select("id,name,kind,updated_at,shop_name,branch_code,branch_name,address,tax_id,phone,email,logo_url").order("updated_at", { ascending: false }),
      supabase.from("stock_items").select("id,location_id,product_id,qty,sold,returned, products(name,sku)"),
      supabase.from("products_view").select("id,name,sku,retail").order("name"),
      supabase.from("campaigns").select("id,name,channel,status").order("created_at", { ascending: false }),
    ]);
    setLocations((l.data as Location[]) || []);
    setStock((s.data as any) || []);
    setProducts((p.data as any) || []);
    setCampaigns((cp.data as Campaign[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); logAudit({ action: "view", entity: "screen", entityId: "b2c" }); }, [load]);

  // โหลดยอดขายของร้านที่เปิดอยู่
  useEffect(() => {
    if (!shopId) { setSales([]); return; }
    supabase.from("consignment_sales").select("id,product_name,qty,amount,sold_at").eq("location_id", shopId).order("sold_at", { ascending: false })
      .then(({ data }) => setSales((data as Sale[]) || []));
  }, [shopId]);

  useBackHandler(popup !== null || shopId !== null || channel !== null, () => {
    if (popup) setPopup(null);
    else if (shopId) setShopId(null);
    else { setChannel(null); setOpen(null); }
  });

  const locsOfKind = (kind: string) => locations.filter((l) => l.kind === kind);
  const itemsOf = (locId: string) => stock.filter((s) => s.location_id === locId);
  const totalOf = (locId: string) => itemsOf(locId).reduce((s, i) => s + i.qty, 0);
  const kindTotal = (kind: string) => locsOfKind(kind).reduce((sum, l) => sum + totalOf(l.id), 0);

  async function touchLoc(id: string) { await supabase.from("stock_locations").update({ updated_at: new Date().toISOString() }).eq("id", id); }

  async function adjust(row: StockRow, field: "qty" | "sold" | "returned", delta: number) {
    const val = Math.max(0, (row as any)[field] + delta);
    await supabase.from("stock_items").update({ [field]: val }).eq("id", row.id);
    await touchLoc(row.location_id);
    await logAudit({ action: "update", entity: "stock", entityId: row.products?.sku, newValue: { [field]: val } });
    load();
  }
  async function recordSale(row: StockRow) {
    const prod = products.find((p) => p.id === row.product_id);
    const amount = prod?.retail || 0;
    await supabase.from("consignment_sales").insert({ location_id: row.location_id, product_id: row.product_id, product_name: row.products?.name, qty: 1, amount });
    await supabase.from("stock_items").update({ sold: row.sold + 1, qty: Math.max(0, row.qty - 1) }).eq("id", row.id);
    await touchLoc(row.location_id);
    await logAudit({ action: "create", entity: "consignment-sale", entityId: row.products?.sku, newValue: { amount } });
    supabase.from("consignment_sales").select("id,product_name,qty,amount,sold_at").eq("location_id", row.location_id).order("sold_at", { ascending: false }).then(({ data }) => setSales((data as Sale[]) || []));
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
    setCampName(""); setPopup(null); load();
  }
  async function toggleCampaign(cp: Campaign) {
    await supabase.from("campaigns").update({ status: cp.status === "active" ? "done" : "active" }).eq("id", cp.id);
    load();
  }
  async function delShop(l: Location) {
    if (!confirm("ลบร้านนี้?")) return;
    await supabase.from("stock_locations").delete().eq("id", l.id);
    await logAudit({ action: "delete", entity: "shop", entityId: l.shop_name || l.name });
    setShopId(null); load();
  }

  if (loading) return <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>;

  /* ================= ร้านฝากขาย: หน้าจัดการร้าน (แยกหน้า) ================= */
  const shop = shopId ? locations.find((l) => l.id === shopId) : null;
  if (shop) {
    const rows = itemsOf(shop.id);
    const now = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthly = sales.filter((s) => new Date(s.sold_at) >= mStart).reduce((a, s) => a + Number(s.amount), 0);
    const total = sales.reduce((a, s) => a + Number(s.amount), 0);
    const monthLabel = now.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    return (
      <div className="px-5 pb-32">
        {/* หัวร้าน */}
        <div className="mt-2 flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-ink text-white">
            {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : <StoreIcon size={26} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-disp text-xl font-extrabold text-foreground">{shop.shop_name || shop.name}</div>
            <div className="text-xs text-muted-foreground">
              {shop.branch_code ? `รหัสสาขา ${shop.branch_code} · ` : ""}{shop.branch_name || "-"}
            </div>
          </div>
          <button onClick={() => { setEditShop(shop); setPopup("shopForm"); }} className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-foreground">แก้ไข</button>
        </div>

        {/* ข้อมูลติดต่อ */}
        <Card className="mt-4 p-4">
          <InfoRow label="ที่อยู่ + เลขผู้เสียภาษี" value={[shop.address, shop.tax_id].filter(Boolean).join(" · ") || "-"} copy={[shop.address, shop.tax_id].filter(Boolean).join(" ")} />
          <InfoRow label="เบอร์ติดต่อ" value={shop.phone || "-"} call={shop.phone || undefined} />
          <InfoRow label="อีเมล" value={shop.email || "-"} copy={shop.email || undefined} last />
        </Card>

        {/* ยอดขาย — แนว fintech */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="text-[11px] text-muted-foreground">ยอดขายเดือนนี้</div>
            <div className="mt-1 font-disp text-[26px] font-extrabold leading-none text-foreground">{baht(monthly)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{monthLabel}</div>
            <button onClick={() => setPopup("monthly")} className="mt-3 inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-foreground">
              ดูรายละเอียด <ChevronRight size={12} />
            </button>
          </Card>
          <Card className="flex flex-col justify-between p-4" >
            <div>
              <div className="text-[11px] text-muted-foreground">ยอดขายรวมทั้งหมด</div>
              <div className="mt-1 font-disp text-[26px] font-extrabold leading-none text-primary">{baht(total)}</div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground"><TrendingUp size={13} className="text-green-600" /> ตั้งแต่เปิดร้าน</div>
          </Card>
        </div>

        {/* สต็อกสินค้า — การ์ดแนวยาว */}
        <div className="mb-3 mt-6 px-1 font-disp text-base font-bold text-foreground">สต็อกสินค้าในร้าน</div>
        <Card className="p-2">
          {rows.length === 0 && <p className="p-3 text-[13px] text-muted-foreground">ยังไม่มีสินค้าในร้านนี้</p>}
          {rows.map((r, i) => (
            <div key={r.id} className={"px-3 py-3" + (i < rows.length - 1 ? " border-b border-border" : "")}>
              <div className="flex items-center justify-between">
                <span className="min-w-0 flex-1 text-[14px] font-semibold text-foreground">{r.products?.name}</span>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="secondary" className="h-8 w-8 rounded-xl" onClick={() => adjust(r, "qty", -1)}><Minus size={14} /></Button>
                  <span className="min-w-[28px] text-center font-disp font-bold">{r.qty}</span>
                  <Button size="icon" variant="secondary" className="h-8 w-8 rounded-xl" onClick={() => adjust(r, "qty", 1)}><Plus size={14} /></Button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => recordSale(r)} className="rounded-full bg-[hsl(var(--primary)/0.1)] px-3 py-1 text-[11.5px] font-bold text-primary">ขาย +1 (เก็บเงิน {r.sold})</button>
                <button onClick={() => adjust(r, "returned", 1)} className="rounded-full bg-secondary px-3 py-1 text-[11.5px] font-semibold text-muted-foreground">คืน +1 ({r.returned})</button>
              </div>
            </div>
          ))}
          <div className="p-2">
            <select defaultValue="" onChange={(e) => { addProductTo(shop.id, e.target.value); e.target.value = ""; }} className="w-full rounded-xl px-3 py-2.5 text-[13px]" style={inputStyle}>
              <option value="" disabled>+ เพิ่มสินค้าเข้าร้าน…</option>
              {products.filter((p) => !rows.some((r) => r.product_id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </Card>

        <button onClick={() => delShop(shop)} className="mt-6 w-full rounded-2xl bg-[hsl(var(--primary)/0.1)] py-3 text-sm font-semibold text-primary">ลบร้านนี้</button>

        {/* popup รายละเอียดยอดขายเดือนนี้ */}
        <Modal open={popup === "monthly"} onClose={() => setPopup(null)} title={`ยอดขายเดือนนี้ · ${monthLabel}`}>
          <div className="pb-4">
            {sales.filter((s) => new Date(s.sold_at) >= mStart).length === 0 && <p className="text-[13px] text-muted-foreground">ยังไม่มีการขายเดือนนี้</p>}
            {sales.filter((s) => new Date(s.sold_at) >= mStart).map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b border-border py-2.5 text-[13px]">
                <span className="text-foreground">{s.product_name || "-"} ×{s.qty}</span>
                <span className="font-disp font-bold">{baht(s.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-3">
              <span className="font-disp font-bold">รวมเดือนนี้</span>
              <span className="font-disp text-lg font-extrabold text-primary">{baht(monthly)}</span>
            </div>
          </div>
        </Modal>

        <Modal open={popup === "shopForm"} onClose={() => setPopup(null)} title="แก้ไขข้อมูลร้าน">
          {popup === "shopForm" && <ShopForm initial={editShop} onDone={() => { setPopup(null); load(); }} />}
        </Modal>
      </div>
    );
  }

  /* ================= ร้านฝากขาย: ตารางการ์ดร้าน ================= */
  if (channel === "consign") {
    const shops = locsOfKind("consign");
    return (
      <div className="px-5 pb-32">
        <div className="mb-3 mt-2 px-1 font-disp text-base font-bold text-foreground">ร้านฝากขาย ({shops.length})</div>
        <div className="grid grid-cols-2 gap-3">
          {shops.map((s) => (
            <Card key={s.id} onClick={() => setShopId(s.id)} className="cursor-pointer p-4">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-ink text-white">
                {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> : <StoreIcon size={22} />}
              </div>
              <div className="mt-3 truncate font-disp text-[15px] font-extrabold text-foreground">{s.shop_name || s.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{s.branch_name || "สาขาหลัก"}</div>
            </Card>
          ))}
          {/* การ์ดเพิ่มร้าน — ขนาดเท่าการ์ด */}
          <button onClick={() => { setEditShop(null); setPopup("shopForm"); }}
            className="flex min-h-[116px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-muted-foreground">
            <Plus size={22} />
            <span className="text-[13px] font-semibold">เพิ่มร้าน</span>
          </button>
        </div>

        <Modal open={popup === "shopForm"} onClose={() => setPopup(null)} title={editShop ? "แก้ไขข้อมูลร้าน" : "เพิ่มร้านฝากขาย"}>
          {popup === "shopForm" && <ShopForm initial={editShop} onDone={() => { setPopup(null); load(); }} />}
        </Modal>
      </div>
    );
  }

  /* ================= ช่องทางอื่น (Online/Shop/Product Stock) ================= */
  if (channel) {
    const meta = CHANNELS.find((c) => c.kind === channel)!;
    const locs = locsOfKind(channel);
    return (
      <div className="px-5 pb-32">
        <div className="mt-2 mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/0.1)]"><meta.icon size={22} className="text-primary" /></div>
          <div>
            <div className="font-disp text-xl font-extrabold text-foreground">{meta.label}</div>
            <div className="text-xs text-muted-foreground">{meta.sub} · รวม {kindTotal(channel)} ชิ้น</div>
          </div>
        </div>
        {locs.length === 0 && <p className="px-1 text-[13px] text-muted-foreground">ยังไม่มีจุดในช่องทางนี้ — เพิ่มด้านล่าง</p>}
        {locs.map((l) => {
          const rows = itemsOf(l.id);
          const isOpen = open === l.id;
          return (
            <Card key={l.id} className="mb-2.5 p-4">
              <div className="flex items-center justify-between" onClick={() => setOpen(isOpen ? null : l.id)}>
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><MapPin size={15} className="text-primary" /> {l.name}</span>
                <span className="font-disp text-xl font-extrabold text-foreground">{totalOf(l.id)}</span>
              </div>
              {isOpen && (
                <div className="mt-3 border-t border-border pt-3">
                  {rows.length === 0 && <p className="mb-2 text-xs text-muted-foreground">ยังไม่มีสินค้าในจุดนี้</p>}
                  {rows.map((r) => (
                    <div key={r.id} className="mb-2 flex items-center justify-between">
                      <span className="min-w-0 flex-1 text-[13px] font-semibold text-foreground">{r.products?.name}</span>
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="secondary" className="h-7 w-7 rounded-lg" onClick={() => adjust(r, "qty", -1)}><Minus size={13} /></Button>
                        <span className="min-w-[26px] text-center font-disp font-bold">{r.qty}</span>
                        <Button size="icon" variant="secondary" className="h-7 w-7 rounded-lg" onClick={() => adjust(r, "qty", 1)}><Plus size={13} /></Button>
                      </div>
                    </div>
                  ))}
                  <select defaultValue="" onChange={(e) => { addProductTo(l.id, e.target.value); e.target.value = ""; }} className="mt-1 w-full rounded-xl px-3 py-2.5 text-[13px]" style={inputStyle}>
                    <option value="" disabled>+ เพิ่มสินค้าเข้าจุดนี้…</option>
                    {products.filter((p) => !rows.some((r) => r.product_id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </Card>
          );
        })}
        <button onClick={() => { setAddName(""); setPopup("loc"); }} className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-bold text-white"><Plus size={16} /> เพิ่มจุด/สาขาใน {meta.label}</button>
        <Modal open={popup === "loc"} onClose={() => setPopup(null)} title={`เพิ่มจุดใน ${meta.label}`}>
          <div className="pb-4">
            <div className="mb-1 text-xs text-muted-foreground">ชื่อจุด/สาขา</div>
            <input autoFocus value={addName} onChange={(e) => setAddName(e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
            <Button onClick={() => addLocation(channel)} className="mt-3 w-full rounded-2xl py-6 text-[15px]">บันทึก</Button>
          </div>
        </Modal>
      </div>
    );
  }

  /* ================= หน้าหลัก B2C: 4 ช่อง + การตลาด ================= */
  return (
    <div className="px-5 pb-32">
      <div className="mb-3 mt-2 px-1 font-disp text-base font-bold text-foreground">ช่องทางขาย</div>
      <div className="grid grid-cols-2 gap-3">
        {CHANNELS.map((c) => (
          <Card key={c.kind} onClick={() => setChannel(c.kind)} className="cursor-pointer p-5">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-foreground"><c.icon size={22} /></div>
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
          <button onClick={() => toggleCampaign(cp)} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: cp.status === "active" ? C.greenSoft : C.bg, color: cp.status === "active" ? C.green : C.sub }}>
            {cp.status === "active" ? "กำลังทำงาน" : "จบแล้ว"}
          </button>
        </Card>
      ))}

      <Modal open={popup === "camp"} onClose={() => setPopup(null)} title="เพิ่มแคมเปญ">
        <div className="pb-4">
          <div className="mb-1 text-xs text-muted-foreground">ชื่อแคมเปญ</div>
          <input autoFocus value={campName} onChange={(e) => setCampName(e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
          <Button onClick={addCampaign} className="mt-3 w-full rounded-2xl py-6 text-[15px]">บันทึก</Button>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value, copy, call, last }: { label: string; value: string; copy?: string; call?: string; last?: boolean }) {
  return (
    <div className={"flex items-start justify-between gap-3 py-2.5" + (last ? "" : " border-b border-border")}>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-[13px] font-medium text-foreground break-words">{value}</div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {call && <a href={`tel:${call}`} className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)] text-primary"><Phone size={14} /></a>}
        {copy && <CopyBtn text={copy} />}
      </div>
    </div>
  );
}

function ShopForm({ initial, onDone }: { initial: Location | null; onDone: () => void }) {
  const [f, setF] = useState({
    shop_name: initial?.shop_name || initial?.name || "", branch_code: initial?.branch_code || "", branch_name: initial?.branch_name || "",
    address: initial?.address || "", tax_id: initial?.tax_id || "", phone: initial?.phone || "", email: initial?.email || "", logo_url: initial?.logo_url || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.shop_name.trim()) { setErr("ต้องมีชื่อร้าน"); return; }
    setBusy(true);
    const payload = { ...f, name: f.shop_name.trim(), kind: "consign", updated_at: new Date().toISOString() };
    const { error } = initial
      ? await supabase.from("stock_locations").update(payload).eq("id", initial.id)
      : await supabase.from("stock_locations").insert(payload);
    if (error) { setErr(error.message); setBusy(false); return; }
    await logAudit({ action: initial ? "update" : "create", entity: "shop", entityId: f.shop_name });
    onDone();
  }
  const inp = (k: string, ph?: string) => (
    <input value={(f as any)[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
  );

  return (
    <div className="pb-4">
      <Field label="ชื่อร้าน">{inp("shop_name", "เช่น Central Chidlom")}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="รหัสสาขา">{inp("branch_code")}</Field>
        <Field label="ชื่อสาขา">{inp("branch_name")}</Field>
      </div>
      <Field label="ที่อยู่ร้าน">{inp("address")}</Field>
      <Field label="เลขผู้เสียภาษี">{inp("tax_id")}</Field>
      <Field label="เบอร์ติดต่อ">{inp("phone")}</Field>
      <Field label="อีเมล">{inp("email")}</Field>
      <Field label="ลิงก์รูปโลโก้ร้าน (ไม่บังคับ)">{inp("logo_url", "https://…")}</Field>
      {err && <p className="mb-2 text-xs text-primary">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
    </div>
  );
}
