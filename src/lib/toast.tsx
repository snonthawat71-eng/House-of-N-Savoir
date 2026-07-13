import { useEffect, useState } from "react";
import { Check, AlertTriangle } from "lucide-react";

/** แจ้งเตือนเด้งบนจอแบบง่าย — เรียกได้จากทุกที่: toast.success() / toast.error() */
type Toast = { id: number; kind: "success" | "error"; msg: string };
let listeners: ((t: Toast) => void)[] = [];
let seq = 0;
function emit(kind: "success" | "error", msg: string) {
  const t = { id: ++seq, kind, msg };
  listeners.forEach((l) => l(t));
}
export const toast = {
  success: (msg = "สำเร็จ") => emit("success", msg),
  error: (msg = "เกิดข้อผิดพลาด") => emit("error", msg),
};

/** วางไว้ครั้งเดียวที่ App — คอยแสดงข้อความแจ้งเตือน */
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const l = (t: Toast) => {
      setItems((s) => [...s, t]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), 2600);
    };
    listeners.push(l);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4"
      style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
      {items.map((t) => (
        <div key={t.id}
          className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lg animate-in fade-in slide-in-from-top-2"
          style={{ background: t.kind === "success" ? "#16A45C" : "#E5322A" }}>
          {t.kind === "success" ? <Check size={18} /> : <AlertTriangle size={18} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}
