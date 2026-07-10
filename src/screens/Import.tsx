import { useState } from "react";
import { Upload, Loader2, Check, FileSpreadsheet } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { C, SHADOW_SM, disp, mono } from "../lib/ui";

type Mode = "products" | "customers";

/** นำเข้า Excel/CSV — สินค้า หรือ ลูกค้า */
export default function ImportScreen() {
  const [mode, setMode] = useState<Mode>("products");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");

  async function handleFile(file: File) {
    setBusy(true); setErr(""); setResult("");
    try {
      let rows: Record<string, any>[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        rows = parseCsv(await file.text());
      } else {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      }
      if (rows.length === 0) throw new Error("ไม่พบข้อมูลในไฟล์");

      const get = (r: any, keys: string[]) => {
        for (const k of Object.keys(r)) {
          if (keys.includes(String(k).trim().toLowerCase())) return r[k];
        }
        return undefined;
      };
      const num = (v: any) => (v == null || v === "" ? null : Number(String(v).replace(/[^\d.-]/g, "")) || 0);

      let ok = 0;
      if (mode === "products") {
        const payload = rows.map((r) => ({
          sku: String(get(r, ["sku", "รหัส", "รหัสสินค้า"]) ?? "").trim(),
          name: String(get(r, ["name", "ชื่อ", "ชื่อสินค้า"]) ?? "").trim(),
          type: String(get(r, ["type", "ประเภท"]) ?? "").trim() || null,
          cost: num(get(r, ["cost", "ต้นทุน"])),
          retail: num(get(r, ["retail", "price", "ราคา", "ราคาขาย"])),
          stock: num(get(r, ["stock", "qty", "คงเหลือ", "จำนวน"])) ?? 0,
        })).filter((p) => p.sku && p.name);
        if (payload.length === 0) throw new Error("ไม่พบคอลัมน์ sku/name (หรือ รหัสสินค้า/ชื่อสินค้า)");
        const { error } = await supabase.from("products").upsert(payload, { onConflict: "sku" });
        if (error) throw error;
        ok = payload.length;
      } else {
        const payload = rows.map((r) => ({
          name: String(get(r, ["name", "ชื่อ", "ชื่อลูกค้า", "บริษัท"]) ?? "").trim(),
          contact: String(get(r, ["contact", "ผู้ติดต่อ"]) ?? "").trim() || null,
          phone: String(get(r, ["phone", "เบอร์", "เบอร์โทร", "โทร"]) ?? "").trim() || null,
          email: String(get(r, ["email", "อีเมล"]) ?? "").trim() || null,
          credit_terms: String(get(r, ["credit", "เครดิต"]) ?? "").trim() || null,
          kind: "b2b",
        })).filter((c) => c.name);
        if (payload.length === 0) throw new Error("ไม่พบคอลัมน์ name (หรือ ชื่อลูกค้า)");
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
        ok = payload.length;
      }
      await logAudit({ action: "create", entity: "import", entityId: mode, newValue: { file: file.name, rows: ok } });
      setResult(`นำเข้าสำเร็จ ${ok} รายการ`);
    } catch (e: any) {
      setErr(e?.message || "นำเข้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 pb-32">
      <p style={{ color: C.sub, fontSize: 13 }} className="mt-2 mb-4 px-1">
        รองรับไฟล์ <b>.xlsx .xls .csv</b> — แถวแรกต้องเป็นหัวคอลัมน์
      </p>

      <div className="flex gap-2 mb-4">
        {([["products", "สินค้า"], ["customers", "ลูกค้า"]] as [Mode, string][]).map(([m, l]) => (
          <button key={m} onClick={() => setMode(m)} className="flex-1 rounded-2xl py-3"
            style={{ background: mode === m ? C.ink : C.card, color: mode === m ? "#fff" : C.ink, fontWeight: 700, fontSize: 14, boxShadow: SHADOW_SM }}>
            {l}
          </button>
        ))}
      </div>

      <div className="rounded-3xl p-4 mb-4" style={{ background: C.card, boxShadow: SHADOW_SM }}>
        <div style={{ fontFamily: disp, fontSize: 14, fontWeight: 700, color: C.ink }} className="mb-2">คอลัมน์ที่ระบบอ่าน ({mode === "products" ? "สินค้า" : "ลูกค้า"})</div>
        <div style={{ fontFamily: mono, fontSize: 11.5, color: C.sub, lineHeight: 1.9 }}>
          {mode === "products"
            ? <>sku (รหัสสินค้า)* · name (ชื่อสินค้า)* · type (ประเภท)<br />cost (ต้นทุน) · retail (ราคาขาย) · stock (คงเหลือ)</>
            : <>name (ชื่อลูกค้า)* · contact (ผู้ติดต่อ) · phone (เบอร์โทร)<br />email (อีเมล) · credit (เครดิต)</>}
        </div>
        <div style={{ color: C.sub, fontSize: 11 }} className="mt-2">* = จำเป็น · ใช้หัวคอลัมน์ไทยหรืออังกฤษก็ได้ · สินค้า sku ซ้ำ = อัปเดตทับ</div>
      </div>

      <label className="w-full rounded-3xl py-10 flex flex-col items-center justify-center gap-3 cursor-pointer"
        style={{ background: C.card, boxShadow: SHADOW_SM, border: `2px dashed ${C.line}` }}>
        {busy ? <Loader2 size={28} className="animate-spin" style={{ color: C.sub }} />
          : <FileSpreadsheet size={28} style={{ color: C.brand }} />}
        <span style={{ color: C.ink, fontSize: 14, fontWeight: 700 }}>{busy ? "กำลังนำเข้า…" : "แตะเพื่อเลือกไฟล์"}</span>
        <span style={{ color: C.sub, fontSize: 12 }}>Excel (.xlsx) หรือ CSV</span>
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </label>

      {result && <p className="mt-3 flex items-center gap-1.5" style={{ color: C.green, fontSize: 13, fontWeight: 600 }}><Check size={15} /> {result}</p>}
      {err && <p className="mt-3" style={{ color: C.red, fontSize: 13 }}>{err}</p>}
    </div>
  );
}

/* ตัวอ่าน CSV แบบง่าย (รองรับเครื่องหมายคำพูด) */
function parseCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let cur: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { cur.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(field); field = "";
      if (cur.some((c) => c.trim() !== "")) lines.push(cur);
      cur = [];
    } else field += ch;
  }
  cur.push(field);
  if (cur.some((c) => c.trim() !== "")) lines.push(cur);
  if (lines.length < 2) return [];
  const head = lines[0].map((h) => h.trim());
  return lines.slice(1).map((row) => Object.fromEntries(head.map((h, i) => [h, row[i] ?? ""])));
}
