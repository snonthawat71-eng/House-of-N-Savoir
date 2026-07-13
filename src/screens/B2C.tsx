import { useEffect, useState, useCallback } from "react";
import {
  Plus, Loader2, MapPin, Minus, TrendingUp, Store, Boxes, Globe, RefreshCcw,
  ChevronRight, Copy, Phone, Check, Store as StoreIcon, Package, Trash2, Pencil,
  Tag, Lock, ArrowLeft, Send, X, AlertTriangle, Scissors, RotateCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, baht, mono, inputStyle } from "../lib/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, DetailRow, DetailActions } from "@/components/ui/modal";
import { ImageUpload } from "@/components/ui/image-upload";
import { Field } from "./B2B";

// ประเภทสินค้า (สำหรับ dropdown + filter ในหน้า Product List)
const PRODUCT_TYPES = ["Interior Spray", "Eau De Parfum", "Diffuser", "Candle"] as const;

type Brand = { id: string; name: string; logo_url: string | null };
type CatalogProduct = {
  id: string; brand_id: string | null; sku: string; name: string;
  type: string | null; size: string | null; image_url: string | null;
  cost: number | null; retail: number | null;
};
type ProdModal = { k: "add" } | { k: "view"; item: CatalogProduct } | { k: "form"; item: CatalogProduct } | null;

type Location = {
  id: string; name: string; kind: string; updated_at?: string;
  shop_name?: string | null; branch_code?: string | null; branch_name?: string | null;
  address?: string | null; tax_id?: string | null; phone?: string | null; email?: string | null; logo_url?: string | null;
};
type StockRow = { id: string; location_id: string; product_id: string; qty: number; sold: number; returned: number; shop_code?: string | null; products?: { name: string; sku: string } };
type Sale = { id: string; product_name: string | null; qty: number; amount: number; sold_at: string };
type Campaign = { id: string; name: string; channel: string | null; status: string };

const CHANNELS: { kind: string; label: string; sub: string; icon: LucideIcon }[] = [
  { kind: "consign", label: "Consignment", sub: "ฝากขาย · เช็คยอด/ของคืน", icon: RefreshCcw },
  { kind: "online", label: "Online", sub: "พร้อมขายออนไลน์", icon: Globe },
  { kind: "store", label: "Shop", sub: "หน้าร้าน", icon: Store },
  { kind: "warehouse", label: "Product List", sub: "แคตตาล็อกสินค้าตามแบรนด์", icon: Boxes },
];

function CostVal({ v }: { v: number | null }) {
  if (v == null) return <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: C.redSoft, color: C.red }}><Lock size={11} /> ลับ</span>;
  return <>{baht(v)}</>;
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  if (!text) return null;
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}
      className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
      {ok ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
    </button>
  );
}

export default function B2C() {
  const auth = useAuth();
  const canEdit = ["owner", "dev", "manager"].includes(auth.profile?.role || "");

  const [channel, setChannel] = useState<string | null>(() => sessionStorage.getItem("b2c_channel") || null);
  const [shopId, setShopId] = useState<string | null>(() => sessionStorage.getItem("b2c_shop") || null);
  const [sub, setSub] = useState<string | null>(() => sessionStorage.getItem("b2c_sub") || null);
  const [brandId, setBrandId] = useState<string | null>(() => sessionStorage.getItem("b2c_brand") || null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; retail: number | null }[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [popup, setPopup] = useState<null | "camp" | "shopForm" | "loc" | "monthly">(null);
  const [itemModal, setItemModal] = useState<StockRow | "add" | null>(null);
  const [sendModal, setSendModal] = useState(false);
  const [stockView, setStockView] = useState<null | "all" | "cut" | "return">(null);
  const [brandModal, setBrandModal] = useState<Brand | "add" | null>(null);
  const [prodModal, setProdModal] = useState<ProdModal>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editShop, setEditShop] = useState<Location | null>(null);
  const [addName, setAddName] = useState("");
  const [campName, setCampName] = useState("");
  const [loading, setLoading] = useState(true);

  // จำหน้าล่าสุดใน session (สลับแอปยังอยู่ / ปิดจริงเริ่มใหม่)
  useEffect(() => { channel ? sessionStorage.setItem("b2c_channel", channel) : sessionStorage.removeItem("b2c_channel"); }, [channel]);
  useEffect(() => { shopId ? sessionStorage.setItem("b2c_shop", shopId) : sessionStorage.removeItem("b2c_shop"); }, [shopId]);
  useEffect(() => { sub ? sessionStorage.setItem("b2c_sub", sub) : sessionStorage.removeItem("b2c_sub"); }, [sub]);
  useEffect(() => { brandId ? sessionStorage.setItem("b2c_brand", brandId) : sessionStorage.removeItem("b2c_brand"); }, [brandId]);

  const load = useCallback(async () => {
    setLoading(true);
    const [l, s, p, cp, br] = await Promise.all([
      supabase.from("stock_locations").select("id,name,kind,updated_at,shop_name,branch_code,branch_name,address,tax_id,phone,email,logo_url").order("updated_at", { ascending: false }),
      supabase.from("stock_items").select("id,location_id,product_id,qty,sold,returned,shop_code, products(name,sku)"),
      supabase.from("products_view").select("id,name,sku,type,size,image_url,brand_id,cost,retail").order("name"),
      supabase.from("campaigns").select("id,name,channel,status").order("created_at", { ascending: false }),
      supabase.from("brands").select("id,name,logo_url").order("name"),
    ]);
    setLocations((l.data as Location[]) || []);
    setStock((s.data as any) || []);
    setProducts((p.data as any) || []);
    setCatalog((p.data as CatalogProduct[]) || []);
    setCampaigns((cp.data as Campaign[]) || []);
    setBrands((br.data as Brand[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); logAudit({ action: "view", entity: "screen", entityId: "b2c" }); }, [load]);

  const loadSales = useCallback((id: string) => {
    supabase.from("consignment_sales").select("id,product_name,qty,amount,sold_at").eq("location_id", id).order("sold_at", { ascending: false }).then(({ data }) => setSales((data as Sale[]) || []));
  }, []);
  useEffect(() => { if (shopId) loadSales(shopId); else setSales([]); }, [shopId, loadSales]);

  useBackHandler(popup !== null || itemModal !== null || brandModal !== null || prodModal !== null || sub !== null || shopId !== null || brandId !== null || channel !== null, () => {
    if (popup) setPopup(null);
    else if (itemModal) setItemModal(null);
    else if (prodModal) setProdModal(null);
    else if (brandModal) setBrandModal(null);
    else if (sub) setSub(null);
    else if (shopId) setShopId(null);
    else if (brandId) { setBrandId(null); setTypeFilter("all"); }
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
    load();
  }
  async function saveItem(row: StockRow, vals: { qty: number; sold: number; returned: number }) {
    await supabase.from("stock_items").update(vals).eq("id", row.id);
    await touchLoc(row.location_id);
    await logAudit({ action: "update", entity: "stock", entityId: row.products?.sku, newValue: vals });
    setItemModal(null); load();
  }
  async function removeItem(row: StockRow) {
    if (!confirm("เอาสินค้านี้ออกจากร้าน?")) return;
    await supabase.from("stock_items").delete().eq("id", row.id);
    setItemModal(null); load();
  }
  async function recordSale(row: StockRow) {
    const prod = products.find((p) => p.id === row.product_id);
    const amount = prod?.retail || 0;
    await supabase.from("consignment_sales").insert({ location_id: row.location_id, product_id: row.product_id, product_name: row.products?.name, qty: 1, amount });
    await supabase.from("stock_items").update({ sold: row.sold + 1, qty: Math.max(0, row.qty - 1) }).eq("id", row.id);
    await touchLoc(row.location_id);
    if (shopId) loadSales(shopId);
    load();
  }
  async function addProductTo(locId: string, productId: string) {
    if (!productId) return;
    await supabase.from("stock_items").upsert({ location_id: locId, product_id: productId, qty: 0 }, { onConflict: "location_id,product_id" });
    setItemModal(null); load();
  }
  // ส่งสต็อกเข้าร้าน: บันทึกประวัติ + เพิ่มจำนวนในสต็อกร้าน
  async function sendStock(v: { product_id: string; shop_code: string; qty: number; sender: string; sent_at: string }) {
    if (!shopId || !v.product_id || v.qty <= 0) return;
    await supabase.from("consignment_shipments").insert({
      location_id: shopId, product_id: v.product_id, shop_code: v.shop_code || null,
      qty: v.qty, sender: v.sender || null, sent_at: v.sent_at,
    });
    const existing = stock.find((s) => s.location_id === shopId && s.product_id === v.product_id);
    if (existing) {
      await supabase.from("stock_items").update({ qty: existing.qty + v.qty, shop_code: v.shop_code || existing.shop_code }).eq("id", existing.id);
    } else {
      await supabase.from("stock_items").insert({ location_id: shopId, product_id: v.product_id, qty: v.qty, shop_code: v.shop_code || null });
    }
    await touchLoc(shopId);
    await logAudit({ action: "create", entity: "consignment-shipment", entityId: v.shop_code || v.product_id, newValue: v });
    setSendModal(false); load();
  }
  // ตัดสต็อก / คืนสินค้า: บันทึกประวัติ + ลดจำนวนในสต็อกร้าน
  async function moveStock(row: StockRow, kind: "cut" | "return", qty: number, movedAt: string) {
    if (!shopId || qty <= 0) return;
    const take = Math.min(qty, row.qty);
    await supabase.from("consignment_movements").insert({ location_id: shopId, product_id: row.product_id, kind, qty: take, moved_at: movedAt });
    const patch: any = { qty: Math.max(0, row.qty - take) };
    if (kind === "return") patch.returned = (row.returned || 0) + take;
    await supabase.from("stock_items").update(patch).eq("id", row.id);
    await touchLoc(shopId);
    await logAudit({ action: "update", entity: kind === "cut" ? "stock-cut" : "stock-return", entityId: row.products?.sku, newValue: { qty: take } });
    load();
  }
  async function addLocation(kind: string) {
    if (!addName.trim()) return;
    await supabase.from("stock_locations").insert({ name: addName.trim(), kind });
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
    setShopId(null); load();
  }
  async function delBrand(b: Brand) {
    if (!confirm(`ลบแบรนด์ "${b.name}"? สินค้าในแบรนด์นี้จะไม่ถูกลบ แต่จะไม่มีแบรนด์`)) return;
    await supabase.from("brands").delete().eq("id", b.id);
    await logAudit({ action: "delete", entity: "brand", entityId: b.name });
    setBrandId(null); setBrandModal(null); load();
  }
  async function delProduct(p: CatalogProduct) {
    if (!confirm("ลบสินค้านี้?")) return;
    await supabase.from("products").delete().eq("id", p.id);
    await logAudit({ action: "delete", entity: "product", entityId: p.sku, oldValue: p });
    setProdModal(null); load();
  }

  if (loading) return <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>;

  const shop = shopId ? locations.find((l) => l.id === shopId) : null;

  /* ===== ร้านฝากขาย: หน้าลิสต์สต็อก (แบบ Product list) ===== */
  if (shop && sub === "stock") {
    const rows = itemsOf(shop.id);
    const shownRows = typeFilter === "all" ? rows : rows.filter((r) => catalog.find((c) => c.id === r.product_id)?.type === typeFilter);
    return (
      <div className="px-5 pb-32">
        <div className="mb-3 mt-2 font-disp text-xl font-extrabold text-foreground">สต็อกสินค้า · {shop.shop_name || shop.name}</div>

        {/* filter ประเภท */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {["all", ...PRODUCT_TYPES].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className="shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
              style={typeFilter === t ? { background: C.ink, color: "#fff" } : { background: C.card, color: C.sub, border: "1px solid " + C.line }}>
              {t === "all" ? "ทั้งหมด" : t}
            </button>
          ))}
        </div>

        {shownRows.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">{rows.length === 0 ? "ยังไม่มีสินค้าในร้าน — กด เพิ่มสินค้า" : "ไม่มีสินค้าประเภทนี้"}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {shownRows.map((r) => {
              const cp = catalog.find((c) => c.id === r.product_id);
              return (
                <Card key={r.id} onClick={() => setItemModal(r)} className="cursor-pointer overflow-hidden p-0">
                  <div className="relative aspect-square w-full overflow-hidden bg-secondary">
                    {cp?.image_url ? (
                      <img src={cp.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><Package size={34} className="text-muted-foreground" /></div>
                    )}
                    <span className="absolute right-2 top-2 rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">คงเหลือ {r.qty}</span>
                    {cp?.type && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">{cp.type}</span>}
                  </div>
                  <div className="px-3 py-3">
                    <div className="truncate font-disp text-[15px] font-extrabold text-foreground">{r.products?.name || cp?.name}</div>
                    <div className="truncate text-[10.5px] text-muted-foreground" style={{ fontFamily: mono }}>{r.shop_code || r.products?.sku || cp?.sku}</div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="font-disp text-[15px] font-bold text-foreground">{baht(cp?.retail ?? null)}</span>
                      <span className="text-[10.5px] text-muted-foreground">ขาย {r.sold}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <button onClick={() => setItemModal("add")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-bold text-white">
          <Plus size={16} /> เพิ่มสินค้าเข้าร้าน
        </button>

        <ItemModal
          state={itemModal} onClose={() => setItemModal(null)}
          products={products.filter((p) => !rows.some((r) => r.product_id === p.id))}
          onAdd={(pid) => addProductTo(shop.id, pid)}
          onSave={saveItem} onRemove={removeItem} onSell={recordSale}
        />
      </div>
    );
  }

  /* ===== ร้านฝากขาย: หน้าจัดการร้าน ===== */
  if (shop) {
    const rows = itemsOf(shop.id);
    const now = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthly = sales.filter((s) => new Date(s.sold_at) >= mStart).reduce((a, s) => a + Number(s.amount), 0);
    const total = sales.reduce((a, s) => a + Number(s.amount), 0);
    const monthLabel = now.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    return (
      <div className="px-5 pb-32">
        {/* หัวร้าน — โลโก้ใหญ่โปร่ง + ข้อมูลด้านข้าง (ไม่มีการ์ดรอง) + ปุ่มแก้ไขมุมขวา */}
        <div className="relative mt-3 flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden">
            {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-contain" /> : <StoreIcon size={44} className="text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1 pr-10">
            <div className="font-disp text-lg font-extrabold text-foreground">{shop.shop_name || shop.name}</div>
            {shop.branch_name && <div className="mt-0.5 text-[11px] text-muted-foreground"><b className="text-foreground">สาขา</b> {shop.branch_name}</div>}
            {shop.branch_code && <div className="text-[11px] text-muted-foreground"><b className="text-foreground">รหัสสาขา</b> {shop.branch_code}</div>}
            {shop.phone && (
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <b className="text-foreground">เบอร์โทร</b> {shop.phone}
                <a href={`tel:${shop.phone}`} className="flex h-6 w-6 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.1)] text-primary"><Phone size={12} /></a>
              </div>
            )}
          </div>
          <button onClick={() => { setEditShop(shop); setPopup("shopForm"); }} aria-label="แก้ไข"
            className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
            <Pencil size={16} />
          </button>
        </div>

        {/* ข้อมูลติดต่อ — ไม่มีการ์ดรอง ตัวเล็ก หัวข้อ bold · ซ่อนช่องที่ว่าง */}
        <div className="mt-5 space-y-3">
          {shop.address && <ContactLine label="ที่อยู่" value={shop.address} copy={shop.address} />}
          {shop.tax_id && <ContactLine label="เลขผู้เสียภาษี" value={shop.tax_id} copy={shop.tax_id} />}
          {shop.email && <ContactLine label="อีเมล" value={shop.email} copy={shop.email} />}
        </div>

        {/* ยอดขาย — fintech */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="text-[11px] text-muted-foreground">ยอดขายเดือนนี้</div>
            <div className="mt-1 font-disp text-[26px] font-extrabold leading-none text-foreground">{baht(monthly)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{monthLabel}</div>
            <button onClick={() => setPopup("monthly")} className="mt-3 inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-foreground">ดูรายละเอียด <ChevronRight size={12} /></button>
          </Card>
          <Card className="flex flex-col justify-between p-4">
            <div>
              <div className="text-[11px] text-muted-foreground">ยอดขายรวมทั้งหมด</div>
              <div className="mt-1 font-disp text-[26px] font-extrabold leading-none text-primary">{baht(total)}</div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground"><TrendingUp size={13} className="text-green-600" /> ตั้งแต่เปิดร้าน</div>
          </Card>
        </div>

        {/* 3 ปุ่มจัดการสต็อก */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <button onClick={() => setStockView("all")} className="flex flex-col items-center gap-1 rounded-2xl bg-card p-3 shadow-sm">
            <Boxes size={24} strokeWidth={1.8} className="text-foreground" />
            <span className="font-disp text-xl font-extrabold text-foreground">{totalOf(shop.id)}</span>
            <span className="text-[11px] text-muted-foreground">สต็อกทั้งหมด</span>
          </button>
          <button onClick={() => setStockView("cut")} className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-card p-3 shadow-sm">
            <Scissors size={24} strokeWidth={1.8} className="text-foreground" />
            <span className="text-[13px] font-bold text-foreground">ตัดสต็อก</span>
          </button>
          <button onClick={() => setStockView("return")} className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-card p-3 shadow-sm">
            <RotateCcw size={24} strokeWidth={1.8} className="text-foreground" />
            <span className="text-[13px] font-bold text-foreground">คืนสินค้า</span>
          </button>
        </div>

        {/* ส่งสต็อกสินค้า — การ์ดยาว สีเด่น (สูง) */}
        <button onClick={() => setSendModal(true)} className="mt-3 flex w-full items-center justify-between rounded-2xl px-5 py-6 text-white shadow-sm" style={{ background: C.brand }}>
          <div className="flex items-center gap-3.5">
            <div className="shrink-0"><Send size={28} strokeWidth={1.8} /></div>
            <div className="text-left">
              <div className="font-disp text-[17px] font-extrabold">ส่งสต็อกสินค้า</div>
              <div className="text-[12.5px] text-white/80">บันทึกการส่งสินค้าเข้าร้านนี้</div>
            </div>
          </div>
          <Plus size={24} />
        </button>

        {/* สต็อก — แถบกด เข้าไปอีกหน้า (จัดการรายการ/เพิ่มสินค้า) */}
        <button onClick={() => setSub("stock")} className="mt-3 flex w-full items-center justify-between rounded-2xl bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="shrink-0"><Package size={26} strokeWidth={1.8} className="text-foreground" /></div>
            <div className="text-left">
              <div className="font-disp text-[15px] font-bold text-foreground">สต็อกสินค้า</div>
              <div className="text-[11px] text-muted-foreground">{rows.length} รายการ · รวม {totalOf(shop.id)} ชิ้น</div>
            </div>
          </div>
          <ChevronRight size={18} className="text-muted-foreground" />
        </button>

        <button onClick={() => delShop(shop)} className="mt-6 w-full rounded-2xl bg-[hsl(var(--destructive)/0.1)] py-3 text-sm font-semibold text-destructive">ลบร้านนี้</button>

        {/* ฟอร์มส่งสต็อก */}
        <Modal open={sendModal} onClose={() => setSendModal(false)} title="ส่งสต็อกเข้าร้าน">
          {sendModal && <SendStockForm brands={brands} catalog={catalog} onSubmit={sendStock} />}
        </Modal>

        {/* สต็อกทั้งหมด / ตัด / คืน */}
        <StockManageModal kind={stockView} rows={itemsOf(shop.id)} catalog={catalog} onClose={() => setStockView(null)} onMove={moveStock} />

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

  /* ===== ร้านฝากขาย: ตารางการ์ดร้าน ===== */
  if (channel === "consign") {
    const shops = locsOfKind("consign");
    return (
      <div className="px-5 pb-32">
        <div className="mb-3 mt-2 px-1 font-disp text-base font-bold text-foreground">ร้านฝากขาย ({shops.length})</div>
        <div className="grid grid-cols-2 gap-3">
          {shops.map((s) => (
            <Card key={s.id} onClick={() => { setSub(null); setShopId(s.id); }} className="cursor-pointer overflow-hidden p-0">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                {s.logo_url ? (
                  <img src={s.logo_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><StoreIcon size={38} className="text-muted-foreground" /></div>
                )}
              </div>
              <div className="px-3 py-3 text-center">
                <div className="truncate font-disp text-[15px] font-extrabold text-foreground">{s.shop_name || s.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{s.branch_name || "สาขาหลัก"}</div>
              </div>
            </Card>
          ))}
          <button onClick={() => { setEditShop(null); setPopup("shopForm"); }}
            className="flex min-h-[172px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-muted-foreground">
            <Plus size={22} /><span className="text-[13px] font-semibold">เพิ่มร้าน</span>
          </button>
        </div>
        <Modal open={popup === "shopForm"} onClose={() => setPopup(null)} title={editShop ? "แก้ไขข้อมูลร้าน" : "เพิ่มร้านฝากขาย"}>
          {popup === "shopForm" && <ShopForm initial={editShop} onDone={() => { setPopup(null); load(); }} />}
        </Modal>
      </div>
    );
  }

  /* ===== Product List: แคตตาล็อกสินค้าตามแบรนด์ (แทนหน้า Product Stock เดิม) ===== */
  if (channel === "warehouse") {
    const brand = brandId ? brands.find((b) => b.id === brandId) : null;

    // --- หน้าแบรนด์: ลิสต์สินค้า + filter ประเภท ---
    if (brand) {
      const prods = catalog.filter((p) => p.brand_id === brand.id);
      const shown = typeFilter === "all" ? prods : prods.filter((p) => p.type === typeFilter);
      return (
        <div className="px-5 pb-32">
          {/* หัวแบรนด์ + ปุ่มเพิ่มสินค้ามุมขวาบน */}
          <div className="relative mb-4 mt-3 flex items-center gap-3 pr-24">
            <button onClick={() => { setBrandId(null); setTypeFilter("all"); }} aria-label="ย้อนกลับ" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground"><ArrowLeft size={17} /></button>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-secondary">
              {brand.logo_url ? <img src={brand.logo_url} alt="" className="h-full w-full object-cover" /> : <Tag size={22} className="text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-disp text-xl font-extrabold text-foreground">{brand.name}</div>
              <div className="text-[11px] text-muted-foreground">{prods.length} สินค้า</div>
            </div>
            {canEdit && (
              <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-2">
                <button onClick={() => setBrandModal(brand)} aria-label="แก้ไขแบรนด์" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground"><Pencil size={15} /></button>
                <button onClick={() => setProdModal({ k: "add" })} aria-label="เพิ่มสินค้า" className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white"><Plus size={20} /></button>
              </div>
            )}
          </div>

          {/* filter ประเภทสินค้า */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {["all", ...PRODUCT_TYPES].map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)} className="shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
                style={typeFilter === t ? { background: C.ink, color: "#fff" } : { background: C.card, color: C.sub, border: "1px solid " + C.line }}>
                {t === "all" ? "ทั้งหมด" : t}
              </button>
            ))}
          </div>

          {/* การ์ดสินค้า 2 คอลัมน์ (ดีไซน์เหมือน consignment) */}
          {shown.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">{prods.length === 0 ? "ยังไม่มีสินค้าในแบรนด์นี้" : "ไม่มีสินค้าประเภทนี้"}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {shown.map((p) => (
                <Card key={p.id} onClick={() => setProdModal({ k: "view", item: p })} className="cursor-pointer overflow-hidden p-0">
                  <div className="relative aspect-square w-full overflow-hidden bg-secondary">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><Package size={34} className="text-muted-foreground" /></div>
                    )}
                    {p.type && <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">{p.type}</span>}
                  </div>
                  <div className="px-3 py-3">
                    <div className="truncate font-disp text-[15px] font-extrabold text-foreground">{p.name}</div>
                    <div className="truncate text-[10.5px] text-muted-foreground" style={{ fontFamily: mono }}>{p.sku}</div>
                    <div className="mt-1.5 font-disp text-[15px] font-bold text-foreground">{baht(p.retail)}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {canEdit && (
            <button onClick={() => delBrand(brand)} className="mt-8 w-full rounded-2xl bg-[hsl(var(--destructive)/0.1)] py-3 text-sm font-semibold text-destructive">ลบแบรนด์นี้</button>
          )}

          {/* ดูรายละเอียดสินค้า */}
          <Modal open={prodModal?.k === "view"} onClose={() => setProdModal(null)} title="รายละเอียดสินค้า">
            {prodModal?.k === "view" && (
              <div className="pb-2">
                {prodModal.item.image_url && <img src={prodModal.item.image_url} alt="" className="mb-3 h-44 w-full rounded-2xl bg-secondary object-contain" />}
                <div className="mb-1 font-disp text-xl font-extrabold text-foreground">{prodModal.item.name}</div>
                <div className="mb-2 text-xs text-muted-foreground" style={{ fontFamily: mono }}>{prodModal.item.sku}</div>
                <DetailRow label="แบรนด์">{brand.name}</DetailRow>
                <DetailRow label="ประเภท">{prodModal.item.type || "-"}</DetailRow>
                <DetailRow label="ขนาด">{prodModal.item.size || "-"}</DetailRow>
                {canEdit && <DetailRow label="ราคาต้นทุน"><CostVal v={prodModal.item.cost} /></DetailRow>}
                <DetailRow label="ราคาขาย">{baht(prodModal.item.retail)}</DetailRow>
                {canEdit && <DetailActions onEdit={() => setProdModal({ k: "form", item: prodModal.item })} onDelete={() => delProduct(prodModal.item)} />}
              </div>
            )}
          </Modal>

          {/* เพิ่ม/แก้ไขสินค้า */}
          <Modal open={prodModal?.k === "add" || prodModal?.k === "form"} onClose={() => setProdModal(null)} title={prodModal?.k === "form" ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}>
            {(prodModal?.k === "add" || prodModal?.k === "form") && (
              <ProductForm brand={brand} initial={prodModal.k === "form" ? prodModal.item : null} onDone={() => { setProdModal(null); load(); }} />
            )}
          </Modal>
        </div>
      );
    }

    // --- หน้ารายชื่อแบรนด์ (การ์ดใหญ่ 2 ต่อแถว) ---
    return (
      <div className="px-5 pb-32">
        <div className="mb-3 mt-2 px-1 font-disp text-base font-bold text-foreground">แบรนด์ ({brands.length})</div>
        <div className="grid grid-cols-2 gap-3">
          {brands.map((b) => (
            <Card key={b.id} onClick={() => { setTypeFilter("all"); setBrandId(b.id); }} className="cursor-pointer overflow-hidden p-0">
              <div className="relative aspect-square w-full overflow-hidden bg-secondary">
                {b.logo_url ? (
                  <img src={b.logo_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Tag size={40} className="text-muted-foreground" /></div>
                )}
              </div>
              <div className="px-3 py-3.5 text-center">
                <div className="truncate font-disp text-[16px] font-extrabold text-foreground">{b.name}</div>
                <div className="text-[11px] text-muted-foreground">{catalog.filter((p) => p.brand_id === b.id).length} สินค้า</div>
              </div>
            </Card>
          ))}
          <button onClick={() => setBrandModal("add")} className="flex min-h-[196px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-muted-foreground">
            <Plus size={24} /><span className="text-[13px] font-semibold">เพิ่มแบรนด์</span>
          </button>
        </div>

        <Modal open={brandModal !== null} onClose={() => setBrandModal(null)} title={brandModal && brandModal !== "add" ? "แก้ไขแบรนด์" : "เพิ่มแบรนด์"}>
          {brandModal !== null && <BrandForm initial={brandModal === "add" ? null : brandModal} onDone={() => { setBrandModal(null); load(); }} />}
        </Modal>
      </div>
    );
  }

  /* ===== ช่องทางอื่น ===== */
  if (channel) {
    const meta = CHANNELS.find((c) => c.kind === channel)!;
    const locs = locsOfKind(channel);
    return (
      <div className="px-5 pb-32">
        <div className="mt-2 mb-4 flex items-center gap-3">
          <div className="shrink-0"><meta.icon size={30} strokeWidth={1.8} className="text-primary" /></div>
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

  /* ===== หน้าหลัก B2C ===== */
  return (
    <div className="px-5 pb-32">
      <div className="mb-3 mt-2 px-1 font-disp text-base font-bold text-foreground">ช่องทางขาย</div>
      <div className="grid grid-cols-2 gap-3">
        {CHANNELS.map((c) => (
          <Card key={c.kind} onClick={() => { setShopId(null); setSub(null); setChannel(c.kind); }} className="cursor-pointer p-5">
            <div className="flex items-center justify-between">
              <div className="shrink-0 text-foreground"><c.icon size={30} strokeWidth={1.8} /></div>
              <span className="font-disp text-2xl font-extrabold text-foreground">{c.kind === "warehouse" ? catalog.length : kindTotal(c.kind)}</span>
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

function ContactLine({ label, value, copy, call }: { label: string; value: string; copy?: string; call?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-foreground">{label}</div>
        <div className="break-words text-[12px] text-muted-foreground">{value}</div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {call && <a href={`tel:${call}`} className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.1)] text-primary"><Phone size={13} /></a>}
        {copy && <CopyBtn text={copy} />}
      </div>
    </div>
  );
}

/* popup เพิ่ม/แก้ไขรายการสต็อกในร้าน */
function ItemModal({ state, onClose, products, onAdd, onSave, onRemove, onSell }: {
  state: StockRow | "add" | null;
  onClose: () => void;
  products: { id: string; name: string }[];
  onAdd: (productId: string) => void;
  onSave: (row: StockRow, vals: { qty: number; sold: number; returned: number }) => void;
  onRemove: (row: StockRow) => void;
  onSell: (row: StockRow) => void;
}) {
  const isAdd = state === "add";
  const row = isAdd ? null : (state as StockRow | null);
  const [pid, setPid] = useState("");
  const [qty, setQty] = useState(row?.qty ?? 0);
  const [sold, setSold] = useState(row?.sold ?? 0);
  const [returned, setReturned] = useState(row?.returned ?? 0);

  // sync เมื่อเปิดรายการใหม่
  const key = row?.id || (isAdd ? "add" : "none");
  useEffect(() => {
    setPid(""); setQty(row?.qty ?? 0); setSold(row?.sold ?? 0); setReturned(row?.returned ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const numInput = (v: number, setV: (n: number) => void) => (
    <input value={v} onChange={(e) => setV(Number(e.target.value.replace(/\D/g, "")) || 0)} inputMode="numeric" className="w-full rounded-2xl px-4 py-3 text-center" style={inputStyle} />
  );

  return (
    <Modal open={state !== null} onClose={onClose} title={isAdd ? "เพิ่มสินค้าเข้าร้าน" : "แก้ไขรายการ"}>
      {isAdd ? (
        <div className="pb-4">
          <div className="mb-1 text-xs text-muted-foreground">เลือกสินค้า</div>
          <select value={pid} onChange={(e) => setPid(e.target.value)} className="w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
            <option value="" disabled>เลือกสินค้า…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button onClick={() => pid && onAdd(pid)} disabled={!pid} className="mt-3 w-full rounded-2xl py-6 text-[15px]">เพิ่มเข้าร้าน</Button>
        </div>
      ) : row ? (
        <div className="pb-4">
          <div className="mb-3 font-disp text-lg font-extrabold text-foreground">{row.products?.name}</div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="คงเหลือ">{numInput(qty, setQty)}</Field>
            <Field label="ขายแล้ว">{numInput(sold, setSold)}</Field>
            <Field label="คืน">{numInput(returned, setReturned)}</Field>
          </div>
          <button onClick={() => onSell(row)} className="mb-3 w-full rounded-2xl bg-[hsl(var(--primary)/0.1)] py-3 text-sm font-bold text-primary">ขาย +1 (บันทึกยอดขาย + ตัดสต็อก)</button>
          <Button onClick={() => onSave(row, { qty, sold, returned })} className="w-full rounded-2xl py-6 text-[15px]">บันทึก</Button>
          <button onClick={() => onRemove(row)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-3 text-sm font-semibold text-muted-foreground"><Trash2 size={15} /> เอาออกจากร้าน</button>
        </div>
      ) : null}
    </Modal>
  );
}

/* ฟอร์มส่งสต็อกเข้าร้านฝากขาย */
function SendStockForm({ brands, catalog, onSubmit }: {
  brands: Brand[];
  catalog: CatalogProduct[];
  onSubmit: (v: { product_id: string; shop_code: string; qty: number; sender: string; sent_at: string }) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [brandId, setBrandId] = useState("");
  const [pid, setPid] = useState("");
  const [shopCode, setShopCode] = useState("");
  const [qty, setQty] = useState("");
  const [sender, setSender] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const prod = catalog.find((p) => p.id === pid);
  const prodOptions = brandId ? catalog.filter((p) => p.brand_id === brandId) : catalog;

  function submit() {
    if (!pid) { setErr("เลือกสินค้าที่ส่งก่อน"); return; }
    const q = Number(qty) || 0;
    if (q <= 0) { setErr("ใส่จำนวนส่ง"); return; }
    setBusy(true);
    const sent_at = date ? new Date(`${date}T${time || "00:00"}:00`).toISOString() : new Date().toISOString();
    onSubmit({ product_id: pid, shop_code: shopCode.trim(), qty: q, sender: sender.trim(), sent_at });
  }

  const ClearBtn = ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick} aria-label="ล้าง" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-muted-foreground"><X size={13} /></button>
  );

  return (
    <div className="pb-4">
      <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
        <Field label="วันที่ส่งสินค้า">
          <div className="relative min-w-0">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="box-border w-full min-w-0 appearance-none rounded-2xl px-3 py-3 pr-8 text-[13px]" style={inputStyle} />
            {date && <ClearBtn onClick={() => setDate("")} />}
          </div>
        </Field>
        <Field label="เวลาส่ง">
          <div className="relative min-w-0">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="box-border w-full min-w-0 appearance-none rounded-2xl px-3 py-3 pr-8 text-[13px]" style={inputStyle} />
            {time && <ClearBtn onClick={() => setTime("")} />}
          </div>
        </Field>
      </div>
      <Field label="แบรนด์">
        <select value={brandId} onChange={(e) => { setBrandId(e.target.value); setPid(""); }} className="w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
          <option value="">ทุกแบรนด์</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Field>
      <Field label="สินค้าที่ส่ง">
        <select value={pid} onChange={(e) => setPid(e.target.value)} className="w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
          <option value="" disabled>เลือกสินค้า…</option>
          {prodOptions.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ""}</option>)}
        </select>
      </Field>
      {prod && (
        <div className="-mt-1 mb-3 flex gap-5 rounded-2xl bg-secondary px-4 py-2.5 text-[12px] text-muted-foreground">
          <span><b className="text-foreground">ประเภท</b> {prod.type || "-"}</span>
          <span><b className="text-foreground">ขนาด</b> {prod.size || "-"}</span>
        </div>
      )}
      <Field label="รหัสสินค้า (เฉพาะร้านนี้)">
        <input value={shopCode} onChange={(e) => setShopCode(e.target.value)} placeholder="รหัสตามร้าน" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
      </Field>
      <div className="mb-4">
        <div className="mb-1 text-xs text-muted-foreground">จำนวนส่ง</div>
        <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0"
          className="w-full rounded-2xl py-4 text-center font-disp font-extrabold" style={{ ...inputStyle, fontSize: 44 }} />
      </div>
      <Field label="ผู้จัดส่ง">
        <input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="ชื่อผู้จัดส่ง" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
      </Field>
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={submit} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังส่ง…" : "ยืนยันส่งสต็อก"}</Button>
    </div>
  );
}

/* Modal จัดการสต็อก: ดูทั้งหมด / ตัดสต็อก / คืนสินค้า */
function StockManageModal({ kind, rows, catalog, onClose, onMove }: {
  kind: null | "all" | "cut" | "return";
  rows: StockRow[];
  catalog: CatalogProduct[];
  onClose: () => void;
  onMove: (row: StockRow, kind: "cut" | "return", qty: number, movedAt: string) => void;
}) {
  const [sel, setSel] = useState<StockRow | null>(null);
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => { if (!kind) { setSel(null); setQty(""); } }, [kind]);

  const title = kind === "all" ? "สต็อกทั้งหมด" : kind === "cut" ? "ตัดสต็อก" : "คืนสินค้า";
  const cp = (id: string) => catalog.find((c) => c.id === id);

  function confirm() {
    if (!sel) return;
    const q = Number(qty) || 0;
    if (q <= 0) return;
    onMove(sel, kind as "cut" | "return", q, date);
    setSel(null); setQty("");
  }

  return (
    <Modal open={kind !== null} onClose={onClose} title={title}>
      <div className="pb-4">
        {rows.length === 0 && <p className="py-6 text-center text-[13px] text-muted-foreground">ยังไม่มีสินค้าในร้าน</p>}

        {sel && kind !== "all" ? (
          <div>
            <button onClick={() => setSel(null)} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground"><ArrowLeft size={15} /> กลับ</button>
            <div className="font-disp text-lg font-extrabold text-foreground">{sel.products?.name || cp(sel.product_id)?.name}</div>
            <div className="mb-3 text-[12px] text-muted-foreground">คงเหลือ {sel.qty} ชิ้น</div>
            <Field label={kind === "cut" ? "วันที่ตัด" : "วันที่คืน"}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
            </Field>
            <div className="mb-1 text-xs text-muted-foreground">จำนวน{kind === "cut" ? "ที่ตัด" : "ที่คืน"}</div>
            <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0"
              className="mb-4 w-full rounded-2xl py-4 text-center font-disp font-extrabold" style={{ ...inputStyle, fontSize: 40 }} />
            <Button onClick={confirm} className="w-full rounded-2xl py-6 text-[15px]">ยืนยัน{kind === "cut" ? "ตัดสต็อก" : "คืนสินค้า"}</Button>
          </div>
        ) : (
          rows.map((r) => {
            const p = cp(r.product_id);
            const low = r.qty < 2;
            return (
              <button key={r.id} onClick={() => kind !== "all" && setSel(r)} className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-secondary p-3 text-left">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-card">
                  {p?.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Package size={20} className="text-muted-foreground" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-foreground">{r.products?.name || p?.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground" style={{ fontFamily: mono }}>{r.shop_code || r.products?.sku || p?.sku} · {baht(p?.retail ?? null)}</div>
                  {low && <div className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-destructive"><AlertTriangle size={11} /> สต็อกต่ำ (เหลือ {r.qty})</div>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-disp text-lg font-extrabold text-foreground">{r.qty}</span>
                  {kind !== "all" && <ChevronRight size={15} className="text-muted-foreground" />}
                </div>
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
}

/* ฟอร์มเพิ่ม/แก้ไขแบรนด์ — มีแค่รูป + ชื่อ */
function BrandForm({ initial, onDone }: { initial: Brand | null; onDone: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [logo, setLogo] = useState(initial?.logo_url || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!name.trim()) { setErr("ต้องมีชื่อแบรนด์"); return; }
    setBusy(true);
    const payload = { name: name.trim(), logo_url: logo || null };
    const { error } = initial
      ? await supabase.from("brands").update(payload).eq("id", initial.id)
      : await supabase.from("brands").insert(payload);
    if (error) { setErr(error.message); setBusy(false); return; }
    await logAudit({ action: initial ? "update" : "create", entity: "brand", entityId: name.trim() });
    onDone();
  }

  return (
    <div className="pb-4">
      <Field label="รูปแบรนด์"><ImageUpload value={logo} onChange={setLogo} folder="brands" /></Field>
      <Field label="ชื่อแบรนด์"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น N SAVOIR" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
    </div>
  );
}

/* ฟอร์มเพิ่ม/แก้ไขสินค้าในแบรนด์ */
function ProductForm({ brand, initial, onDone }: { brand: Brand; initial: CatalogProduct | null; onDone: () => void }) {
  const isNew = !initial;
  const [image, setImage] = useState(initial?.image_url || "");
  const [sku, setSku] = useState(initial?.sku || "");
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "");
  const [size, setSize] = useState(initial?.size || "");
  const [cost, setCost] = useState<string>(initial?.cost != null ? String(initial.cost) : "");
  const [retail, setRetail] = useState<string>(initial?.retail != null ? String(initial.retail) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^\d.]/g, "")) || 0);

  async function save() {
    if (!sku.trim() || !name.trim()) { setErr("ต้องมีรหัสสินค้า (SKU) และชื่อสินค้า"); return; }
    setBusy(true);
    const payload = {
      brand_id: brand.id, sku: sku.trim(), name: name.trim(),
      type: type || null, size: size.trim() || null, image_url: image || null,
      cost: num(cost), retail: num(retail), updated_at: new Date().toISOString(),
    };
    const { error } = isNew
      ? await supabase.from("products").insert(payload)
      : await supabase.from("products").update(payload).eq("id", initial!.id);
    if (error) { setErr("บันทึกไม่สำเร็จ: " + error.message); setBusy(false); return; }
    await logAudit({ action: isNew ? "create" : "update", entity: "product", entityId: sku.trim(), newValue: payload });
    onDone();
  }

  return (
    <div className="pb-4">
      <Field label="รูปสินค้า"><ImageUpload value={image} onChange={setImage} folder="products" /></Field>
      <Field label="ชื่อแบรนด์">
        <input value={brand.name} disabled readOnly className="w-full cursor-not-allowed rounded-2xl px-4 py-3 opacity-70" style={inputStyle} />
      </Field>
      <Field label="รหัสสินค้า (SKU)"><input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="NS-EDP-001" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="ชื่อสินค้า"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuit de Vétiver" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="ประเภทสินค้า">
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
          <option value="">เลือกประเภท…</option>
          {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="ขนาดสินค้า"><input value={size} onChange={(e) => setSize(e.target.value)} placeholder="เช่น 50ml, 220g" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ราคาต้นทุน (฿)"><input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="numeric" placeholder="420" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
        <Field label="ราคาขาย (฿)"><input value={retail} onChange={(e) => setRetail(e.target.value)} inputMode="numeric" placeholder="2900" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      </div>
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
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
  const inp = (k: string, ph?: string) => (
    <input value={(f as any)[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
  );

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

  return (
    <div className="pb-4">
      <Field label="โลโก้ร้าน"><ImageUpload value={f.logo_url} onChange={(url) => set("logo_url", url)} folder="shops" /></Field>
      <Field label="ชื่อร้าน">{inp("shop_name", "เช่น Central Chidlom")}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="รหัสสาขา">{inp("branch_code")}</Field>
        <Field label="ชื่อสาขา">{inp("branch_name")}</Field>
      </div>
      <Field label="ที่อยู่ร้าน">{inp("address")}</Field>
      <Field label="เลขผู้เสียภาษี">{inp("tax_id")}</Field>
      <Field label="เบอร์ติดต่อ">{inp("phone")}</Field>
      <Field label="อีเมล">{inp("email")}</Field>
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
    </div>
  );
}
