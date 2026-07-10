import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, Lock } from "lucide-react";
import { supabase } from "./lib/supabase";
import { useAuth } from "./lib/auth";
import { logAudit } from "./lib/audit";
import { useBackHandler } from "./lib/nav";
import { C, SHADOW_SM, disp, mono, baht, inputStyle } from "./lib/ui";
import { Modal, DetailRow, DetailActions } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field } from "./screens/B2B";

type Product = {
  id?: string; sku: string; name: string; type: string | null;
  cost: number | null; retail: number | null; stock: number;
};
const EMPTY: Product = { sku: "", name: "", type: "", cost: null, retail: null, stock: 0 };

type ModalState = { k: "form"; item: Product } | { k: "view"; item: Product } | null;

export default function ProductsScreen() {
  const auth = useAuth();
  const role = auth.profile?.role || "sales";
  const canEdit = ["owner", "dev", "manager"].includes(role);

  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products_view").select("id, sku, name, type, cost, retail, stock").order("name");
    if (error) setErr("โหลดสินค้าไม่ได้: " + error.message);
    setRows((data as Product[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useBackHandler(modal !== null, () => setModal(null));

  const close = () => setModal(null);
  const done = () => { setModal(null); load(); };

  async function del(p: Product) {
    if (!p.id || !confirm("ลบสินค้านี้?")) return;
    await supabase.from("products").delete().eq("id", p.id);
    await logAudit({ action: "delete", entity: "product", entityId: p.sku, oldValue: p });
    done();
  }

  const CostVal = ({ v }: { v: number | null }) =>
    v == null
      ? <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: C.redSoft, color: C.red }}><Lock size={11} /> ลับ</span>
      : <>{baht(v)}</>;

  return (
    <div className="px-5 pb-32">
      <p className="mb-3 mt-2 px-1 text-xs text-muted-foreground">คีย์ครั้งเดียว ใช้ทั้ง 4 หมวด</p>
      {canEdit && (
        <button onClick={() => setModal({ k: "form", item: { ...EMPTY } })} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-bold text-white">
          <Plus size={16} /> เพิ่มสินค้าใหม่
        </button>
      )}
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">ยังไม่มีสินค้า</p>
      ) : (
        rows.map((p) => (
          <div key={p.sku} onClick={() => setModal({ k: "view", item: p })} className="mb-2.5 cursor-pointer rounded-3xl bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-disp text-base font-bold text-foreground">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">{p.type}</div>
              </div>
              <span className="text-[11px] text-muted-foreground" style={{ fontFamily: mono }}>{p.sku}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: C.line }}>
              <div>
                <div className="text-[10px] text-muted-foreground">ต้นทุน</div>
                <div className="mt-0.5 font-disp text-sm font-bold text-foreground"><CostVal v={p.cost} /></div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">ราคาขาย</div>
                <div className="mt-0.5 font-disp text-sm font-bold text-foreground">{baht(p.retail)}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">คงเหลือ</div>
                <div className="mt-0.5 font-disp text-sm font-bold" style={{ color: p.stock <= 12 ? C.red : C.ink }}>{p.stock}</div>
              </div>
            </div>
          </div>
        ))
      )}

      <Modal open={modal?.k === "view"} onClose={close} title="รายละเอียดสินค้า">
        {modal?.k === "view" && (
          <div className="pb-2">
            <div className="mb-1 font-disp text-xl font-extrabold text-foreground">{modal.item.name}</div>
            <div className="mb-2 text-xs text-muted-foreground" style={{ fontFamily: mono }}>{modal.item.sku}</div>
            <DetailRow label="ประเภท">{modal.item.type || "-"}</DetailRow>
            <DetailRow label="ต้นทุน"><CostVal v={modal.item.cost} /></DetailRow>
            <DetailRow label="ราคาขาย">{baht(modal.item.retail)}</DetailRow>
            <DetailRow label="คงเหลือ">{modal.item.stock}</DetailRow>
            {canEdit && <DetailActions onEdit={() => setModal({ k: "form", item: modal.item })} onDelete={() => del(modal.item)} />}
          </div>
        )}
      </Modal>

      <Modal open={modal?.k === "form"} onClose={close} title={modal?.k === "form" && modal.item.id ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}>
        {modal?.k === "form" && <ProductFields initial={modal.item} onDone={done} />}
      </Modal>
    </div>
  );
}

function ProductFields({ initial, onDone }: { initial: Product; onDone: () => void }) {
  const isNew = !initial.id;
  const [f, setF] = useState<Product>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof Product, v: any) => setF((s) => ({ ...s, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^\d.]/g, "")) || 0);

  async function save() {
    if (!f.sku.trim() || !f.name.trim()) { setErr("ต้องมีรหัส (SKU) และชื่อสินค้า"); return; }
    setBusy(true);
    const payload = { sku: f.sku.trim(), name: f.name.trim(), type: f.type?.trim() || null, cost: f.cost, retail: f.retail, stock: Number(f.stock) || 0, updated_at: new Date().toISOString() };
    const { error } = isNew
      ? await supabase.from("products").insert(payload)
      : await supabase.from("products").update(payload).eq("id", initial.id);
    if (error) { setErr("บันทึกไม่สำเร็จ: " + error.message); setBusy(false); return; }
    await logAudit({ action: isNew ? "create" : "update", entity: "product", entityId: f.sku, newValue: payload });
    onDone();
  }

  return (
    <div className="pb-4">
      <Field label="รหัสสินค้า (SKU)"><input value={f.sku} onChange={(e) => set("sku", e.target.value)} placeholder="NS-EDP-001" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="ชื่อสินค้า"><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Nuit de Vétiver" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="ประเภท"><input value={f.type || ""} onChange={(e) => set("type", e.target.value)} placeholder="Eau de Parfum 50ml" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ต้นทุน (฿)"><input value={f.cost ?? ""} onChange={(e) => set("cost", num(e.target.value))} inputMode="numeric" placeholder="420" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
        <Field label="ราคาขาย (฿)"><input value={f.retail ?? ""} onChange={(e) => set("retail", num(e.target.value))} inputMode="numeric" placeholder="2900" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      </div>
      <Field label="คงเหลือ (ชิ้น)"><input value={f.stock ?? 0} onChange={(e) => set("stock", num(e.target.value) ?? 0)} inputMode="numeric" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
    </div>
  );
}
