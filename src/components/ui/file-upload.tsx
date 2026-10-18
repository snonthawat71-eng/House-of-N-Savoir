import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

export type UploadedFile = { path: string; name: string; type: string; size: number };

/** ขนาดไฟล์ให้อ่านง่าย */
export const prettySize = (n?: number | null) => {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * อัปโหลดไฟล์อะไรก็ได้ (PDF, PPT, AI, ZIP, รูป ฯลฯ) เข้าที่เก็บแบบปิด
 * คืนค่าเป็น "ที่อยู่ไฟล์" ไม่ใช่ลิงก์สาธารณะ — เวลาจะเปิดต้องขอลิงก์ชั่วคราวทีหลัง
 */
export function FileUpload({ bucket = "docs", folder = "misc", onDone }: {
  bucket?: string;
  folder?: string;
  onDone: (f: UploadedFile) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX = 40 * 1024 * 1024; // 40 MB

  async function upload(file: File) {
    if (file.size > MAX) { setErr("ไฟล์ใหญ่เกิน 40 MB"); return; }
    setBusy(true); setErr("");
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true, contentType: file.type || "application/octet-stream",
    });
    if (error) {
      setErr(error.message.includes("Bucket not found") ? "ยังไม่ได้สร้างที่เก็บไฟล์ (รัน SQL 0019 ก่อน)" : error.message);
      setBusy(false); return;
    }
    onDone({ path, name: file.name, type: file.type || ext, size: file.size });
    setBusy(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
        className="flex w-full flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed py-8 transition-colors"
        style={{ borderColor: drag ? "#014BAA" : "#EAECEF", background: drag ? "#E7EEF7" : "transparent" }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-muted-foreground">
          {busy ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
        </div>
        <div className="text-[13px] font-bold text-foreground">{busy ? "กำลังอัปโหลด…" : "คลิกเพื่อเลือกไฟล์"}</div>
        <div className="text-[11px] text-muted-foreground">PDF · PPT · AI · ZIP · รูปภาพ (ไม่เกิน 40 MB)</div>
      </button>
      <input ref={inputRef} type="file" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  );
}

/** ขอลิงก์ชั่วคราว (1 ชม.) แล้วเปิดไฟล์ในแท็บใหม่ */
export async function openDocFile(path: string, bucket = "docs") {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
