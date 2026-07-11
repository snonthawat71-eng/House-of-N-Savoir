import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, ShieldCheck, FlaskConical, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, SHADOW_SM, disp, mono, baht, inputStyle } from "../lib/ui";
import { Field } from "./B2B";
import { Modal, DetailActions } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type Line = { ingredient: string; pct: number };
type Formula = {
  id: string; name: string; product_sku: string | null; lines: Line[];
  cost_material: number; cost_packaging: number; multiplier: number; note: string | null;
};

type ModalState = { k: "form"; item: Formula | null } | { k: "view"; item: Formula } | null;

export default function FormulaLab() {
  const [list, setList] = useState<Formula[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("formulas").select("id,name,product_sku,lines,cost_material,cost_packaging,multiplier,note").order("name");
    setList((data as Formula[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); logAudit({ action: "view", entity: "formula-lab", entityId: "screen" }); }, [load]);
  useBackHandler(modal !== null, () => setModal(null));

  const close = () => setModal(null);
  const done = () => { setModal(null); load(); };

  function openFormula(f: Formula) {
    logAudit({ action: "view", entity: "formula", entityId: f.name }); // ลับสุดยอด — บันทึกทุกการเปิดดู
    setModal({ k: "view", item: f });
  }
  async function del(f: Formula) {
    if (!confirm("ลบสูตรนี้ถาวร?")) return;
    await supabase.from("formulas").delete().eq("id", f.id);
    await logAudit({ action: "delete", entity: "formula", entityId: f.name });
    done();
  }

  return (
    <div className="px-5 pb-32">
      <div className="mt-2 flex items-center gap-3 rounded-3xl p-4" style={{ background: C.ink }}>
        <ShieldCheck size={22} style={{ color: C.brand }} />
        <div>
          <div className="font-disp text-[15px] font-bold text-white">พื้นที่ลับสุดยอด</div>
          <div className="text-[11px]" style={{ color: "#9AA0A6" }}>ทุกการเข้าดูถูกบันทึกใน Audit Log</div>
        </div>
      </div>

      <div className="mb-3 mt-6 flex items-center justify-between px-1">
        <span className="font-disp text-base font-bold text-foreground">สูตรทั้งหมด ({list.length})</span>
        <button onClick={() => setModal({ k: "form", item: null })} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white"><Plus size={13} /> สูตรใหม่</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>
      ) : list.length === 0 ? (
        <p className="px-1 text-[13px] text-muted-foreground">ยังไม่มีสูตร — กด "สูตรใหม่" เพื่อสร้าง</p>
      ) : (
        list.map((f) => (
          <div key={f.id} onClick={() => openFormula(f)} className="mb-2.5 flex cursor-pointer items-center gap-3 rounded-3xl bg-card p-4 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl">
              <FlaskConical size={20} style={{ color: C.brand }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-disp text-[15px] font-bold text-foreground">{f.name}</div>
              <div className="text-[11.5px] text-muted-foreground">{(f.lines || []).length} ส่วนผสม{f.product_sku ? ` · ${f.product_sku}` : ""}</div>
            </div>
          </div>
        ))
      )}

      {/* ดูสูตร */}
      <Modal open={modal?.k === "view"} onClose={close} title="สูตร (ลับสุดยอด)">
        {modal?.k === "view" && <FormulaView f={modal.item} onEdit={() => setModal({ k: "form", item: modal.item })} onDelete={() => del(modal.item)} />}
      </Modal>

      {/* เพิ่ม/แก้สูตร */}
      <Modal open={modal?.k === "form"} onClose={close} title={modal?.k === "form" && modal.item ? "แก้ไขสูตร" : "สร้างสูตรใหม่"}>
        {modal?.k === "form" && <FormulaFields initial={modal.item} onDone={done} />}
      </Modal>
    </div>
  );
}

function FormulaView({ f, onEdit, onDelete }: { f: Formula; onEdit: () => void; onDelete: () => void }) {
  const totalPct = (f.lines || []).reduce((s, l) => s + (Number(l.pct) || 0), 0);
  const costTotal = (Number(f.cost_material) || 0) + (Number(f.cost_packaging) || 0);
  const price = costTotal * (Number(f.multiplier) || 0);
  return (
    <div className="pb-2">
      <div className="mb-1 font-disp text-xl font-extrabold text-foreground">{f.name}</div>
      {f.product_sku && <div className="mb-3 text-xs text-muted-foreground" style={{ fontFamily: mono }}>{f.product_sku}</div>}

      <div className="mt-2 mb-2 font-disp text-sm font-bold text-foreground">สูตรผสมกลิ่น</div>
      <div className="rounded-2xl bg-secondary p-4">
        {(f.lines || []).map((l, i, a) => (
          <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: i < a.length - 1 ? `1px solid ${C.line}` : "none" }}>
            <span className="text-[13px] text-foreground">{l.ingredient}</span>
            <span className="text-[13px] font-bold" style={{ fontFamily: mono, color: C.brand }}>{l.pct}%</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
          <span className="text-xs text-muted-foreground">รวม</span>
          <span className="text-[13px] font-bold" style={{ fontFamily: mono, color: totalPct === 100 ? C.green : C.sub }}>{totalPct}%</span>
        </div>
      </div>

      <div className="mt-4 mb-2 font-disp text-sm font-bold text-foreground">ต้นทุน → ราคา</div>
      <div className="rounded-2xl bg-secondary p-4">
        {[["ต้นทุนวัตถุดิบ/ขวด", baht(f.cost_material)], ["บรรจุภัณฑ์", baht(f.cost_packaging)], ["ต้นทุนรวม", baht(costTotal)], [`ราคาขายแนะนำ (×${f.multiplier})`, baht(Math.round(price))]].map(([n, v], i) => (
          <div key={String(n)} className="flex items-center justify-between py-2" style={{ borderBottom: i < 3 ? `1px solid ${C.line}` : "none" }}>
            <span className="text-[13px]" style={{ color: C.ink, fontWeight: i === 3 ? 700 : 400 }}>{n}</span>
            <span className="font-disp text-sm font-bold" style={{ color: i === 3 ? C.brand : C.ink }}>{v}</span>
          </div>
        ))}
      </div>
      <DetailActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function FormulaFields({ initial, onDone }: { initial: Formula | null; onDone: () => void }) {
  const [f, setF] = useState({
    name: initial?.name || "", product_sku: initial?.product_sku || "",
    cost_material: initial?.cost_material ?? 0, cost_packaging: initial?.cost_packaging ?? 0,
    multiplier: initial?.multiplier ?? 4.8, note: initial?.note || "",
  });
  const [lines, setLines] = useState<Line[]>(initial?.lines || []);
  const [ing, setIng] = useState(""); const [pct, setPct] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));
  const num = (v: string) => Number(v.replace(/[^\d.]/g, "")) || 0;
  const totalPct = lines.reduce((s, l) => s + (Number(l.pct) || 0), 0);
  const costTotal = f.cost_material + f.cost_packaging;

  function addLine() {
    if (!ing.trim() || !pct.trim()) return;
    setLines([...lines, { ingredient: ing.trim(), pct: Number(pct) }]);
    setIng(""); setPct("");
  }

  async function save() {
    if (!f.name.trim()) { setErr("ต้องมีชื่อสูตร"); return; }
    setBusy(true);
    const payload = { ...f, name: f.name.trim(), lines, updated_at: new Date().toISOString() };
    const { error } = initial
      ? await supabase.from("formulas").update(payload).eq("id", initial.id)
      : await supabase.from("formulas").insert(payload);
    if (error) { setErr(error.message); setBusy(false); return; }
    await logAudit({ action: initial ? "update" : "create", entity: "formula", entityId: f.name });
    onDone();
  }

  return (
    <div className="pb-4">
      <Field label="ชื่อสูตร/กลิ่น"><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น Nuit de Vétiver" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="ผูกกับสินค้า (SKU · ไม่บังคับ)"><input value={f.product_sku} onChange={(e) => set("product_sku", e.target.value)} placeholder="NS-EDP-001" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label={`ส่วนผสม (รวมตอนนี้ ${totalPct}%)`}>
        {lines.map((l, i) => (
          <div key={i} className="mb-2 flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5 shadow-sm">
            <span className="flex-1 text-[13px] text-foreground">{l.ingredient}</span>
            <span className="text-[13px] font-bold" style={{ fontFamily: mono, color: C.brand }}>{l.pct}%</span>
            <button onClick={() => setLines(lines.filter((_, x) => x !== i))}><X size={14} style={{ color: C.sub }} /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <input value={ing} onChange={(e) => setIng(e.target.value)} placeholder="ชื่อวัตถุดิบ" className="flex-1 rounded-2xl px-3 py-3" style={inputStyle} />
          <input value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="%" className="w-16 rounded-2xl px-2 py-3 text-center" style={inputStyle} />
          <button onClick={addLine} className="flex w-11 shrink-0 items-center justify-center rounded-2xl bg-ink"><Plus size={16} className="text-white" /></button>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ต้นทุนวัตถุดิบ/ขวด (฿)"><input value={f.cost_material || ""} onChange={(e) => set("cost_material", num(e.target.value))} inputMode="numeric" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
        <Field label="บรรจุภัณฑ์ (฿)"><input value={f.cost_packaging || ""} onChange={(e) => set("cost_packaging", num(e.target.value))} inputMode="numeric" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      </div>
      <Field label="ตัวคูณราคาขาย (เช่น 4.8)"><input value={f.multiplier || ""} onChange={(e) => set("multiplier", num(e.target.value))} inputMode="decimal" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <div className="mb-3 flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: C.brandSoft }}>
        <span className="text-[13px] font-semibold text-foreground">ต้นทุนรวม {baht(costTotal)} → ราคาแนะนำ</span>
        <span className="font-disp text-base font-extrabold" style={{ color: C.brand }}>{baht(Math.round(costTotal * f.multiplier))}</span>
      </div>
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : "บันทึกสูตร"}</Button>
    </div>
  );
}
