import { useState } from "react";
import { Check, Copy, Phone } from "lucide-react";

/** ปุ่มก๊อปข้อความ — กดแล้วขึ้นติ๊กถูกสั้น ๆ */
export function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  if (!text) return null;
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}
      className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
      {ok ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
    </button>
  );
}

/** บรรทัดข้อมูลติดต่อ: หัวข้อตัวหนา + ค่า + ปุ่มโทร/ก๊อป */
export function ContactLine({ label, value, copy, call }: { label: string; value: string; copy?: string; call?: string }) {
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
