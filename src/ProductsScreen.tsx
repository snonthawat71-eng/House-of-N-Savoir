import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, Lock, ArrowLeft, Trash2 } from "lucide-react";
import { supabase } from "./lib/supabase";
import { useAuth } from "./lib/auth";
import { logAudit } from "./lib/audit";
import { useBackHandler } from "./lib/nav";

const C = {
  bg: "#F1F2F4", card: "#FFFFFF", ink: "#111214",
  sub: "#8A8F98", line: "#EAECEF", red: "#E5322A", redSoft: "#FDECEA",
};
const SHADOW_SM = "0 1px 2px rgba(17,18,20,.05), 0 4px 12px rgba(17,18,20,.05)";
const disp = "'Plus Jakarta Sans', system-ui, sans-serif";
const mono = "'Space Mono', ui-monospace, monospace";
const baht = (n: number | null | undefined) =>
  n == null ? "" : "฿" + Number(n).toLocaleString("th-TH");

type Product = {
  id?: string; sku: string; name: string; type: string | null;
  cost: number | null; retail: number | null; stock: number;
};

const EMPTY: Product = { sku: "", name: "", type: "", cost: null, retail: null, stock: 0 };

export default function ProductsScreen() {
  const auth = useAuth();
  const role = auth.profile?.role || "sales";
  const canEdit = ["owner", "dev", "manager"].includes(role);

  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null); // null = ไม่ได้เปิดฟอร์ม
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products_view")
      .select("id, sku, name, type, cost, retail, stock")
      .order("name");
    if (error) setErr("โหลดสินค้าไม่ได้: " + error.message);
    setRows((data as Product[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useBackHandler(editing !== null, () => setEditing(null));

  if (editing) {
    return <ProductForm initial={editing} onBack={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />;
  }

  return (
    <div className="px-5 pb-32">
      <p style={{ color: C.sub, fontSize: 12 }} className="mt-2 mb-3 px-1">คีย์ครั้งเดียว ใช้ทั้ง 4 หมวด</p>

      {canEdit && (
        <button onClick={() => setEditing({ ...EMPTY })}
          className="w-full mb-3 rounded-2xl py-3.5 flex items-center justify-center gap-2"
          style={{ background: C.ink, color: "#fff", fontWeight: 700, fontSize: 14 }}>
          <Plus size={16} /> เพิ่มสินค้าใหม่
        </button>
      )}

      {err && <p style={{ color: C.red, fontSize: 12 }} className="mb-2">{err}</p>}

      {loading ? (
        <div className="flex justify-center py-10" style={{ color: C.sub }}><Loader2 size={22} className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p style={{ color: C.sub, fontSize: 13 }} className="text-center py-10">ยังไม่มีสินค้า</p>
      ) : (
        rows.map((p) => (
          <div key={p.sku} onClick={() => canEdit && setEditing(p)}
            className="rounded-3xl p-4 mb-2.5" style={{ background: C.card, boxShadow: SHADOW_SM }}>
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>{p.name}</div>
                <div style={{ color: C.sub, fontSize: 11 }}>{p.type}</div>
              </div>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.sub }}>{p.sku}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
              <div>
                <div style={{ color: C.sub, fontSize: 10 }}>ต้นทุน</div>
                <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 14, color: C.ink, marginTop: 2 }}>
                  {p.cost == null
                    ? <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5" style={{ background: C.redSoft, color: C.red, fontSize: 11, fontWeight: 600 }}><Lock size={11} /> ลับ</span>
                    : baht(p.cost)}
                </div>
              </div>
              <div>
                <div style={{ color: C.sub, fontSize: 10 }}>ราคาขาย</div>
                <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 14, color: C.ink, marginTop: 2 }}>{baht(p.retail)}</div>
              </div>
              <div>
                <div style={{ color: C.sub, fontSize: 10 }}>คงเหลือ</div>
                <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 14, color: p.stock <= 12 ? C.red : C.ink, marginTop: 2 }}>{p.stock}</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ProductForm({ initial, onBack, onSaved }: { initial: Product; onBack: () => void; onSaved: () => void }) {
  const isNew = !initial.id;
  const [f, setF] = useState<Product>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof Product, v: any) => setF((s) => ({ ...s, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^\d.]/g, "")));

  async function save() {
    setErr("");
    if (!f.sku.trim() || !f.name.trim()) { setErr("ต้องมีรหัส (SKU) และชื่อสินค้า"); return; }
    setBusy(true);
    const payload = {
      sku: f.sku.trim(), name: f.name.trim(), type: f.type?.trim() || null,
      cost: f.cost, retail: f.retail, stock: Number(f.stock) || 0, updated_at: new Date().toISOString(),
    };
    let error;
    if (isNew) {
      ({ error } = await supabase.from("products").insert(payload));
    } else {
      ({ error } = await supabase.from("products").update(payload).eq("id", initial.id));
    }
    if (error) { setErr("บันทึกไม่สำเร็จ: " + error.message); setBusy(false); return; }
    await logAudit({ action: isNew ? "create" : "update", entity: "product", entityId: f.sku, newValue: payload });
    setBusy(false);
    onSaved();
  }

  async function remove() {
    if (!initial.id) return;
    if (!confirm("ลบสินค้านี้?")) return;
    setBusy(true);
    const { error } = await supabase.from("products").delete().eq("id", initial.id);
    if (error) { setErr("ลบไม่สำเร็จ: " + error.message); setBusy(false); return; }
    await logAudit({ action: "delete", entity: "product", entityId: initial.sku, oldValue: initial });
    setBusy(false);
    onSaved();
  }

  const field = (label: string, node: React.ReactNode) => (
    <div className="mb-3">
      <div style={{ color: C.sub, fontSize: 12 }} className="mb-1">{label}</div>
      {node}
    </div>
  );
  const inputStyle = { background: C.bg, border: "none", outline: "none", fontSize: 15, color: C.ink } as const;

  return (
    <div className="px-5 pb-32">
      <div style={{ fontFamily: disp, fontSize: 20, fontWeight: 800, color: C.ink }} className="mt-2 mb-4">
        {isNew ? "เพิ่มสินค้าใหม่" : "แก้ไขสินค้า"}
      </div>

      {field("รหัสสินค้า (SKU)", <input value={f.sku} onChange={(e) => set("sku", e.target.value)} placeholder="NS-EDP-001" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />)}
      {field("ชื่อสินค้า", <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Nuit de Vétiver" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />)}
      {field("ประเภท", <input value={f.type || ""} onChange={(e) => set("type", e.target.value)} placeholder="Eau de Parfum 50ml" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />)}
      <div className="grid grid-cols-2 gap-3">
        {field("ต้นทุน (฿)", <input value={f.cost ?? ""} onChange={(e) => set("cost", num(e.target.value))} inputMode="numeric" placeholder="420" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />)}
        {field("ราคาขาย (฿)", <input value={f.retail ?? ""} onChange={(e) => set("retail", num(e.target.value))} inputMode="numeric" placeholder="2900" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />)}
      </div>
      {field("คงเหลือ (ชิ้น)", <input value={f.stock ?? 0} onChange={(e) => set("stock", num(e.target.value) ?? 0)} inputMode="numeric" placeholder="0" className="w-full rounded-2xl px-4 py-3" style={inputStyle} />)}

      {err && <p style={{ color: C.red, fontSize: 12 }} className="mb-2">{err}</p>}

      <button onClick={save} disabled={busy}
        className="w-full rounded-2xl py-4 flex items-center justify-center gap-2 mt-1"
        style={{ background: C.red, color: "#fff", fontWeight: 700, fontSize: 15, opacity: busy ? 0.6 : 1 }}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : "บันทึก"}
      </button>

      {!isNew && (
        <button onClick={remove} disabled={busy}
          className="w-full rounded-2xl py-3 flex items-center justify-center gap-2 mt-3"
          style={{ background: C.redSoft, color: C.red, fontWeight: 600, fontSize: 14 }}>
          <Trash2 size={15} /> ลบสินค้า
        </button>
      )}
    </div>
  );
}
