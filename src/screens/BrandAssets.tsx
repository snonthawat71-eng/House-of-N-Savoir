/**
 * Brand Assets — ไฟล์งานแบรนด์ (โลโก้ · Presentation · Marketing · Packaging)
 * เก็บไฟล์ที่เดียว แสดง 2 ที่
 *  - หน้า Office  : เห็นทั้งหมด กรองตามหมวด/ตามลูกค้าได้
 *  - หน้าลูกค้า B2B: เห็นเฉพาะของแบรนด์นั้น + ไฟล์งานกลางของบริษัทต่อท้าย
 * ไฟล์อยู่ในที่เก็บแบบปิด เวลาจะเปิดต้องขอลิงก์ชั่วคราว (หมดอายุใน 1 ชม.)
 * (ชื่อตารางในฐานข้อมูลยังเป็น documents เหมือนเดิม ไม่ต้องรัน SQL ใหม่)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Loader2, FileText, Image as ImageIcon, Presentation, Megaphone, Package,
  Download, Trash2, Search as SearchIcon, Building2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, mono, inputStyle, fmtDate } from "../lib/ui";
import { toast } from "../lib/toast";
import { Modal, DeleteButton } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FileUpload, openDocFile, prettySize, type UploadedFile } from "@/components/ui/file-upload";
import { Field } from "@/components/ui/field";

export type Asset = {
  id: string; customer_id: string | null; category: string; title: string;
  file_path: string; file_name: string | null; file_type: string | null; file_size: number | null;
  note: string | null; created_at: string;
};

/** หมวดไฟล์งาน — ลำดับนี้ใช้ทั้งตัวกรองและฟอร์ม */
export const ASSET_CATS = [
  { k: "logo", label: "โลโก้", icon: ImageIcon },
  { k: "presentation", label: "Presentation", icon: Presentation },
  { k: "marketing", label: "Marketing", icon: Megaphone },
  { k: "packaging", label: "Packaging", icon: Package },
  { k: "other", label: "อื่น ๆ", icon: FileText },
] as const;

const catOf = (k: string) => ASSET_CATS.find((c) => c.k === k) || ASSET_CATS[4];

type Customer = { id: string; name: string; brand_name: string | null };
type ModalState = { k: "form"; item: Asset | null } | null;

export default function BrandAssets({ customer }: { customer?: { id: string; name: string; brand_name?: string | null } | null }) {
  const [docs, setDocs] = useState<Asset[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [d, c] = await Promise.all([
      supabase.from("documents").select("id,customer_id,category,title,file_path,file_name,file_type,file_size,note,created_at").order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name,brand_name").eq("kind", "b2b").order("name"),
    ]);
    setDocs((d.data as Asset[]) || []);
    setCustomers((c.data as Customer[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); logAudit({ action: "view", entity: "screen", entityId: customer ? `brand-assets:${customer.id}` : "brand-assets" }); }, [load, customer]);
  useBackHandler(modal !== null, () => setModal(null));

  const nameOf = (id: string | null) => {
    if (!id) return "ไฟล์งานกลาง";
    const c = customers.find((x) => x.id === id);
    return c ? (c.brand_name || c.name) : "—";
  };

  async function open(d: Asset) {
    const url = await openDocFile(d.file_path);
    if (!url) { toast.error("เปิดไฟล์ไม่สำเร็จ"); return; }
    await logAudit({ action: "view", entity: "brand-asset", entityId: d.id, newValue: { title: d.title } });
    window.open(url, "_blank", "noopener");
  }

  async function del(d: Asset) {
    if (!confirm(`ลบไฟล์ "${d.title}"?`)) return;
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) { toast.error("ลบไม่สำเร็จ"); return; }
    await supabase.storage.from("docs").remove([d.file_path]);
    await logAudit({ action: "delete", entity: "brand-asset", entityId: d.id, oldValue: { title: d.title } });
    toast.success("ลบไฟล์แล้ว");
    setModal(null);
    load();
  }

  /* ---------- แยกชุดเอกสารตามที่มาของหน้า ---------- */
  const filt = (list: Asset[]) => {
    const s = q.trim().toLowerCase();
    return list.filter((d) =>
      (cat === "all" || d.category === cat) &&
      (!s || d.title.toLowerCase().includes(s) || (d.file_name || "").toLowerCase().includes(s)));
  };
  const mine = useMemo(() => filt(docs.filter((d) => (customer ? d.customer_id === customer.id : true))), [docs, customer, cat, q]);
  const shared = useMemo(() => (customer ? filt(docs.filter((d) => !d.customer_id)) : []), [docs, customer, cat, q]);

  const Row = ({ d, canDelete = true }: { d: Asset; canDelete?: boolean }) => {
    const Ic = catOf(d.category).icon;
    return (
      <div className="mb-2 flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-sm">
        <button onClick={() => open(d)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: C.brandSoft }}>
            <Ic size={18} style={{ color: C.brand }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold text-foreground">{d.title}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {catOf(d.category).label}
              {!customer && ` · ${nameOf(d.customer_id)}`}
              {d.file_size ? ` · ${prettySize(d.file_size)}` : ""} · {fmtDate(d.created_at)}
            </div>
          </div>
        </button>
        <button onClick={() => open(d)} aria-label="เปิดไฟล์" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
          <Download size={16} />
        </button>
        {canDelete && (
          <button onClick={() => del(d)} aria-label="ลบ" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-destructive"
            style={{ background: "hsl(var(--destructive)/0.1)" }}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>;

  return (
    <div className={customer ? "" : "px-5 pb-32"}>
      {/* หัวเรื่อง + ปุ่มเพิ่ม */}
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="font-disp text-base font-bold text-foreground">
          {customer ? `ไฟล์งานของ ${customer.brand_name || customer.name}` : `ไฟล์งานทั้งหมด (${docs.length})`}
        </span>
        <button onClick={() => setModal({ k: "form", item: null })} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
          <Plus size={13} /> เพิ่มไฟล์
        </button>
      </div>

      {/* ค้นหา + กรองหมวด */}
      <div className="mb-3 flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5 shadow-sm">
        <SearchIcon size={15} className="shrink-0 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อไฟล์งาน…"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          style={{ color: C.ink, boxShadow: "none", border: "none" }} />
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {[{ k: "all", label: "ทั้งหมด" }, ...ASSET_CATS].map((c) => (
          <button key={c.k} onClick={() => setCat(c.k)} className="shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
            style={cat === c.k ? { background: C.ink, color: "#fff" } : { background: C.card, color: C.sub, border: "1px solid " + C.line }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* รายการเอกสาร */}
      {mine.length === 0
        ? <p className="py-6 text-center text-[13px] text-muted-foreground">ยังไม่มีไฟล์ในหมวดนี้</p>
        : mine.map((d) => <Row key={d.id} d={d} />)}

      {/* เอกสารกลาง — โชว์เฉพาะตอนเปิดจากหน้าลูกค้า */}
      {customer && (
        <>
          <div className="mb-2 mt-7 flex items-center gap-2 px-1">
            <Building2 size={15} className="text-muted-foreground" />
            <span className="font-disp text-base font-bold text-foreground">ไฟล์งานกลางของบริษัท</span>
          </div>
          <p className="mb-3 px-1 text-[11.5px] text-muted-foreground">ใช้ร่วมกับลูกค้าทุกราย · แก้ไข/ลบได้ที่หน้า Office</p>
          {shared.length === 0
            ? <p className="py-4 text-center text-[13px] text-muted-foreground">ยังไม่มีไฟล์งานกลาง</p>
            : shared.map((d) => <Row key={d.id} d={d} canDelete={false} />)}
        </>
      )}

      {/* ---------- ฟอร์มเพิ่ม/แก้ไข ---------- */}
      <Modal open={modal?.k === "form"} onClose={() => setModal(null)} title={modal?.k === "form" && modal.item ? "แก้ไขไฟล์งาน" : "เพิ่มไฟล์งาน"}>
        {modal?.k === "form" && (
          <AssetForm
            initial={modal.item}
            customers={customers}
            lockedCustomerId={customer?.id ?? undefined}
            onDone={() => { setModal(null); load(); }}
            onDelete={modal.item ? () => del(modal.item!) : undefined}
          />
        )}
      </Modal>
    </div>
  );
}

/* ============================================================ */
function AssetForm({ initial, customers, lockedCustomerId, onDone, onDelete }: {
  initial: Asset | null;
  customers: Customer[];
  lockedCustomerId?: string;
  onDone: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [category, setCategory] = useState(initial?.category || "logo");
  const [owner, setOwner] = useState<string>(lockedCustomerId ?? initial?.customer_id ?? "");
  const [note, setNote] = useState(initial?.note || "");
  const [file, setFile] = useState<UploadedFile | null>(
    initial ? { path: initial.file_path, name: initial.file_name || "", type: initial.file_type || "", size: initial.file_size || 0 } : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!file) { setErr("เลือกไฟล์ก่อน"); return; }
    if (!title.trim()) { setErr("ตั้งชื่อไฟล์งานก่อน"); return; }
    setBusy(true);
    const payload = {
      customer_id: owner || null, category, title: title.trim(), note: note.trim() || null,
      file_path: file.path, file_name: file.name, file_type: file.type, file_size: file.size,
    };
    const { error } = initial
      ? await supabase.from("documents").update(payload).eq("id", initial.id)
      : await supabase.from("documents").insert({ ...payload, created_by: (await supabase.auth.getSession()).data.session?.user.id ?? null });
    if (error) { setErr(error.message); toast.error("บันทึกไม่สำเร็จ"); setBusy(false); return; }
    await logAudit({ action: initial ? "update" : "create", entity: "brand-asset", entityId: title, newValue: payload });
    toast.success(initial ? "แก้ไขไฟล์งานแล้ว" : "เพิ่มไฟล์งานแล้ว");
    onDone();
  }

  return (
    <div className="pb-4">
      <Field label="ไฟล์">
        {file ? (
          <div className="flex items-center gap-3 rounded-2xl bg-secondary p-3.5">
            <FileText size={20} className="shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-foreground">{file.name || "ไฟล์ที่อัปแล้ว"}</div>
              <div className="text-[11px] text-muted-foreground" style={{ fontFamily: mono }}>{prettySize(file.size)}</div>
            </div>
            <button onClick={() => setFile(null)} className="shrink-0 text-[12px] font-semibold text-destructive">เปลี่ยนไฟล์</button>
          </div>
        ) : (
          <FileUpload folder={owner ? `customers/${owner}` : "shared"}
            onDone={(f) => { setFile(f); if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, "")); }} />
        )}
      </Field>

      <Field label="ชื่อไฟล์งาน">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น โลโก้ไฟล์ AI"
          className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
      </Field>

      <Field label="หมวด">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
          {ASSET_CATS.map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}
        </select>
      </Field>

      {!lockedCustomerId && (
        <Field label="เป็นไฟล์งานของ">
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className="w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
            <option value="">ไฟล์งานกลางของบริษัท (ใช้ร่วมทุกราย)</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.brand_name || c.name}</option>)}
          </select>
        </Field>
      )}

      <Field label="โน้ต (ไม่บังคับ)">
        <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} />
      </Field>

      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
      {onDelete && <DeleteButton onClick={onDelete} label="ลบไฟล์งานนี้" />}
    </div>
  );
}
