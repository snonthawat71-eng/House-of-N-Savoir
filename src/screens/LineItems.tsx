import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { C, disp, baht, inputStyle } from "../lib/ui";

export type LineItem = { sku?: string; name: string; qty: number; price: number };
export const itemsTotal = (items: LineItem[]) => items.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);

/** ตัวเลือกสินค้า + รายการบรรทัด (ใช้กับออเดอร์ / ใบเสนอราคา / PO) */
export function LineItemsEditor({ items, onChange, freeText = false }: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  /** true = พิมพ์ชื่อเองได้ ไม่ผูกกับสินค้ากลาง (ใช้กับ PO วัตถุดิบ) */
  freeText?: boolean;
}) {
  const [products, setProducts] = useState<{ sku: string; name: string; retail: number | null }[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (freeText) return;
    supabase.from("products_view").select("sku,name,retail").order("name").then(({ data }) => setProducts((data as any) || []));
  }, [freeText]);

  function add() {
    const n = name.trim();
    if (!n) return;
    const p = products.find((x) => x.name === n || x.sku === n);
    const priceNum = price.trim() !== "" ? Number(price) : (p?.retail ?? 0);
    onChange([...items, { sku: p?.sku, name: p?.name || n, qty: Number(qty) || 1, price: priceNum }]);
    setName(""); setQty("1"); setPrice("");
  }
  function removeAt(i: number) { onChange(items.filter((_, x) => x !== i)); }

  return (
    <div className="mb-3">
      <div style={{ color: C.sub, fontSize: 12 }} className="mb-1">รายการสินค้า</div>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2 rounded-2xl px-4 py-3 mb-2" style={{ background: C.card, boxShadow: "0 1px 2px rgba(17,18,20,.05)" }}>
          <span className="flex-1 min-w-0" style={{ color: C.ink, fontSize: 13, fontWeight: 600 }}>{it.name}</span>
          <span style={{ color: C.sub, fontSize: 12 }}>×{it.qty}</span>
          <span style={{ fontFamily: disp, color: C.ink, fontSize: 13, fontWeight: 700 }}>{baht(it.qty * it.price)}</span>
          <button onClick={() => removeAt(i)}><X size={15} style={{ color: C.sub }} /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <div className="flex-1">
          <input list="li-products" value={name} onChange={(e) => setName(e.target.value)}
            placeholder={freeText ? "ชื่อรายการ/วัตถุดิบ" : "เลือกสินค้า"} className="w-full rounded-2xl px-3 py-3" style={inputStyle} />
          {!freeText && <datalist id="li-products">{products.map((p) => <option key={p.sku} value={p.name} />)}</datalist>}
        </div>
        <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="จำนวน" className="rounded-2xl px-2 py-3 text-center" style={{ ...inputStyle, width: 64 }} />
        <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} inputMode="numeric" placeholder="ราคา" className="rounded-2xl px-2 py-3 text-center" style={{ ...inputStyle, width: 76 }} />
        <button onClick={add} className="rounded-2xl flex items-center justify-center shrink-0" style={{ width: 44, background: C.ink }}>
          <Plus size={16} style={{ color: "#fff" }} />
        </button>
      </div>
      <div className="flex justify-between mt-2 px-1">
        <span style={{ color: C.sub, fontSize: 12 }}>ราคาเว้นว่าง = ใช้ราคาขายจากสินค้ากลาง</span>
        <span style={{ fontFamily: disp, fontWeight: 800, color: C.ink, fontSize: 14 }}>{baht(itemsTotal(items))}</span>
      </div>
    </div>
  );
}
