import { useRef, useState } from "react";
import { UploadCloud, Loader2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";

/** อัปโหลดรูป (คลิกหรือโยนไฟล์) → เก็บใน Supabase Storage แล้วคืน public URL */
export function ImageUpload({ value, onChange, folder = "misc" }: {
  value?: string | null;
  onChange: (url: string) => void;
  folder?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) { setErr("ไฟล์ต้องเป็นรูปภาพ"); return; }
    setBusy(true); setErr("");
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { setErr(error.message.includes("Bucket not found") ? "ยังไม่ได้สร้างที่เก็บไฟล์ (รัน SQL 0006 ก่อน)" : error.message); setBusy(false); return; }
    const { data } = supabase.storage.from("uploads").getPublicUrl(path);
    onChange(data.publicUrl);
    setBusy(false);
  }

  if (value) {
    return (
      <div className="relative">
        <img src={value} alt="" className="h-40 w-full rounded-2xl object-contain" style={{ background: "transparent" }} />
        <button onClick={() => onChange("")} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
        className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-10 transition-colors"
        style={{ borderColor: drag ? "#E5322A" : "#EAECEF", background: drag ? "#FDECEA" : "transparent" }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border text-muted-foreground">
          {busy ? <Loader2 size={22} className="animate-spin" /> : <UploadCloud size={22} />}
        </div>
        <div className="text-center text-[13px] text-muted-foreground">
          <span className="font-bold text-foreground">คลิกเพื่ออัปโหลด</span> หรือโยนไฟล์มาวาง<br />
          PNG, JPG, SVG หรือ GIF
        </div>
      </button>
      {err && <p className="mt-2 text-xs text-primary">{err}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
    </div>
  );
}
