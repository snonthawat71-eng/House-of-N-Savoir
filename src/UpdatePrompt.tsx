import { useRegisterSW } from "virtual:pwa-register/react";
import { ArrowUpRight } from "lucide-react";

const C = { ink: "#111214", red: "#E5322A", sub: "#9AA0A6" };
const disp = "'Plus Jakarta Sans', system-ui, sans-serif";
const sans = "'Inter', system-ui, sans-serif";

/**
 * แถบแจ้งเตือนเมื่อมีเวอร์ชันใหม่ของแอป
 * ผู้ใช้กด "อัปเดต" เอง (ไม่อัปเดตเงียบ ๆ)
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pt-3 z-50" style={{ fontFamily: sans }}>
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: C.ink, boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>
        <div className="flex-1">
          <div style={{ color: "#fff", fontFamily: disp, fontSize: 14, fontWeight: 700 }}>มีเวอร์ชันใหม่</div>
          <div style={{ color: C.sub, fontSize: 12 }}>กดอัปเดตเพื่อใช้เวอร์ชันล่าสุด</div>
        </div>
        <button onClick={() => setNeedRefresh(false)}
          style={{ color: C.sub, fontSize: 13, fontWeight: 600, padding: "8px 6px", background: "transparent", border: "none" }}>
          ภายหลัง
        </button>
        <button onClick={() => updateServiceWorker(true)}
          className="rounded-full flex items-center gap-1"
          style={{ background: C.red, color: "#fff", fontSize: 13, fontWeight: 700, padding: "9px 16px", border: "none" }}>
          อัปเดต <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  );
}
