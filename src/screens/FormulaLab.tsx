import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, ArrowLeft, ShieldCheck, FlaskConical, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { C, SHADOW_SM, disp, mono, baht, inputStyle } from "../lib/ui";
import { Field } from "./B2B";

type Line = { ingredient: string; pct: number };
type Formula = {
  id: string; name: string; product_sku: string | null; lines: Line[];
  cost_material: number; cost_packaging: number; multiplier: number; note: string | null;
};

export default function FormulaLab() {
  const [list, setList] = useState<Formula[]>([]);
  const [openF, setOpenF] = useState<Formula | null>(null);
  const [editing, setEditing] = useState<Formula | null | "new">(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("formulas")
      .select("id,name,product_sku,lines,cost_material,cost_packaging,multiplier,note")
      .order("name");
    setList((data as Formula[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); logAudit({ action: "view", entity: "formula-lab", entityId: "screen" }); }, [load]);

  // เปิดดูสูตร = บันทึก log ทุกครั้ง (ข้อมูลลับสุดยอด)
  function openFormula(f: Formula) {
    logAudit({ action: "view", entity: "formula", entityId: f.name });
    setOpenF(f);
  }

  if (editing) {
    return <FormulaForm initial={editing === "new" ? null : editing} onDone={() => { setEditing(null); setOpenF(null); load(); }} />;
  }

  if (openF) {
    const totalPct = (openF.lines || []).reduce((s, l) => s + (Number(l.pct) || 0), 0);
    const costTotal = (Number(openF.cost_material) || 0) + (Number(openF.cost_packaging) || 0);
    const price = costTotal * (Number(openF.multiplier) || 0);
    return (
      <div className="px-5 pb-32">
        <button onClick={() => setOpenF(null)} className="flex items-center gap-2 mt-2 mb-4" style={{ color: C.sub, fontSize: 14 }}>
          <ArrowLeft size={18} /> กลับ
        </button>
        <div className="rounded-3xl p-4 flex items-center gap-3" style={{ background: C.ink }}>
          <ShieldCheck size={22} style={{ color: C.red }} />
          <div>
            <div style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: "#fff" }}>{openF.name}</div>
            <div style={{ fontSize: 11, color: "#9AA0A6" }}>การเข้าดูครั้งนี้ถูกบันทึกใน Audit Log แล้ว</div>
          </div>
        </div>

        <div className="px-1 mb-3 mt-6" style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>สูตรผสมกลิ่น</div>
        <div className="rounded-3xl p-4" style={{ background: C.card, boxShadow: SHADOW_SM }}>
          {(openF.lines || []).map((l, i, a) => (
            <div key={i} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < a.length - 1 ? `1px solid ${C.line}` : "none" }}>
              <span style={{ color: C.ink, fontSize: 13 }}>{l.ingredient}</span>
              <span style={{ fontFamily: mono, fontSize: 13, color: C.red, fontWeight: 700 }}>{l.pct}%</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2.5 mt-1" style={{ borderTop: `1px solid ${C.line}` }}>
            <span style={{ color: C.sub, fontSize: 12 }}>รวม</span>
            <span style={{ fontFamily: mono, fontSize: 13, color: totalPct === 100 ? C.green : C.sub, fontWeight: 700 }}>{totalPct}%</span>
          </div>
        </div>

        <div className="px-1 mb-3 mt-6" style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>คำนวณต้นทุน → ราคา</div>
        <div className="rounded-3xl p-4" style={{ background: C.card, boxShadow: SHADOW_SM }}>
          {[
            ["ต้นทุนวัตถุดิบ/ขวด", baht(openF.cost_material)],
            ["บรรจุภัณฑ์", baht(openF.cost_packaging)],
            ["ต้นทุนรวม", baht(costTotal)],
            [`ราคาขายแนะนำ (×${openF.multiplier})`, baht(Math.round(price))],
          ].map(([n, v], i) => (
            <div key={String(n)} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < 3 ? `1px solid ${C.line}` : "none" }}>
              <span style={{ color: C.ink, fontSize: 13, fontWeight: i === 3 ? 700 : 400 }}>{n}</span>
              <span style={{ fontFamily: disp, fontSize: 14, fontWeight: 700, color: i === 3 ? C.red : C.ink }}>{v}</span>
            </div>
          ))}
        </div>

        <button onClick={() => setEditing(openF)} className="w-full rounded-2xl py-4 mt-4" style={{ background: C.ink, color: "#fff", fontWeight: 700, fontSize: 14 }}>
          แก้ไขสูตรนี้
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pb-32">
      <div className="rounded-3xl p-4 mt-2 flex items-center gap-3" style={{ background: C.ink }}>
        <ShieldCheck size={22} style={{ color: C.red }} />
        <div>
          <div style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: "#fff" }}>พื้นที่ลับสุดยอด</div>
          <div style={{ fontSize: 11, color: "#9AA0A6" }}>ทุกการเข้าดูถูกบันทึกใน Audit Log</div>
        </div>
      </div>

      <div className="px-1 mb-3 mt-6 flex items-center justify-between">
        <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>สูตรทั้งหมด ({list.length})</span>
        <button onClick={() => setEditing("new")} className="rounded-full flex items-center gap-1 px-3 py-1.5" style={{ background: C.red, color: "#fff", fontSize: 12, fontWeight: 600 }}>
          <Plus size={13} /> สูตรใหม่
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-10" style={{ color: C.sub }}><Loader2 size={22} className="animate-spin" /></div>
      ) : list.length === 0 ? (
        <p style={{ color: C.sub, fontSize: 13 }} className="px-1">ยังไม่มีสูตร — กด "สูตรใหม่" เพื่อสร้าง</p>
      ) : (
        list.map((f) => (
          <div key={f.id} onClick={() => openFormula(f)} className="rounded-3xl p-4 mb-2.5 flex items-center gap-3" style={{ background: C.card, boxShadow: SHADOW_SM }}>
            <div className="rounded-2xl flex items-center justify-center" style={{ width: 44, height: 44, background: C.redSoft }}>
              <FlaskConical size={20} style={{ color: C.red }} />
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: C.ink }}>{f.name}</div>
              <div style={{ color: C.sub, fontSize: 11.5 }}>
                {(f.lines || []).length} ส่วนผสม{f.product_sku ? ` · ${f.product_sku}` : ""}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function FormulaForm({ initial, onDone }: { initial: Formula | null; onDone: () => void }) {
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
  async function remove() {
    if (!initial || !confirm("ลบสูตรนี้ถาวร?")) return;
    await supabase.from("formulas").delete().eq("id", initial.id);
    await logAudit({ action: "delete", entity: "formula", entityId: initial.name });
    onDone();
  }

  return (
    <div className="px-5 pb-32">
      <button onClick={onDone} className="flex items-center gap-2 mt-2 mb-4" style={{ color: C.sub, fontSize: 14 }}>
        <ArrowLeft size={18} /> กลับ
      </button>
      <div style={{ fontFamily: disp, fontSize: 20, fontWeight: 800, color: C.ink }} className="mb-4">
        {initial ? "แก้ไขสูตร" : "สร้างสูตรใหม่"}
      </div>
      <Field label="ชื่อสูตร/กลิ่น"><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น Nuit de Vétiver" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="ผูกกับสินค้า (SKU · ไม่บังคับ)"><input value={f.product_sku} onChange={(e) => set("product_sku", e.target.value)} placeholder="NS-EDP-001" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>

      <Field label={`ส่วนผสม (% รวมตอนนี้ ${totalPct}%)`}>
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2 rounded-2xl px-4 py-2.5 mb-2" style={{ background: C.card, boxShadow: SHADOW_SM }}>
            <span className="flex-1" style={{ color: C.ink, fontSize: 13 }}>{l.ingredient}</span>
            <span style={{ fontFamily: mono, color: C.red, fontSize: 13, fontWeight: 700 }}>{l.pct}%</span>
            <button onClick={() => setLines(lines.filter((_, x) => x !== i))}><X size={14} style={{ color: C.sub }} /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <input value={ing} onChange={(e) => setIng(e.target.value)} placeholder="ชื่อวัตถุดิบ เช่น Vetiver Haiti" className="flex-1 rounded-2xl px-3 py-3" style={inputStyle} />
          <input value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="%" className="rounded-2xl px-2 py-3 text-center" style={{ ...inputStyle, width: 64 }} />
          <button onClick={addLine} className="rounded-2xl flex items-center justify-center shrink-0" style={{ width: 44, background: C.ink }}>
            <Plus size={16} style={{ color: "#fff" }} />
          </button>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ต้นทุนวัตถุดิบ/ขวด (฿)"><input value={f.cost_material || ""} onChange={(e) => set("cost_material", num(e.target.value))} inputMode="numeric" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
        <Field label="บรรจุภัณฑ์ (฿)"><input value={f.cost_packaging || ""} onChange={(e) => set("cost_packaging", num(e.target.value))} inputMode="numeric" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      </div>
      <Field label="ตัวคูณราคาขาย (เช่น 4.8)"><input value={f.multiplier || ""} onChange={(e) => set("multiplier", num(e.target.value))} inputMode="decimal" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>

      <div className="rounded-2xl px-4 py-3 mb-3 flex items-center justify-between" style={{ background: C.redSoft }}>
        <span style={{ color: C.ink, fontSize: 13, fontWeight: 600 }}>ต้นทุนรวม {baht(costTotal)} → ราคาแนะนำ</span>
        <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 800, color: C.red }}>{baht(Math.round(costTotal * f.multiplier))}</span>
      </div>

      {err && <p style={{ color: C.red, fontSize: 12 }} className="mb-2">{err}</p>}
      <button onClick={save} disabled={busy} className="w-full rounded-2xl py-4" style={{ background: C.red, color: "#fff", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
        {busy ? "กำลังบันทึก…" : "บันทึกสูตร"}
      </button>
      {initial && (
        <button onClick={remove} className="w-full rounded-2xl py-3 mt-3 flex items-center justify-center gap-2" style={{ background: C.redSoft, color: C.red, fontWeight: 600, fontSize: 14 }}>
          <Trash2 size={15} /> ลบสูตร
        </button>
      )}
    </div>
  );
}
