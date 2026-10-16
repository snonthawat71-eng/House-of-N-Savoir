import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/** เวอร์ชันแอป + เวลาที่ build — ใส่ค่าให้ตอน build ใน vite.config.ts */
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
export const BUILD_TIME: string =
  typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "";

/** เวลาที่ build แบบอ่านง่าย เช่น 16 ต.ค. 2569 16:45 */
export function buildTimeText() {
  if (!BUILD_TIME) return "";
  const d = new Date(BUILD_TIME);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

type CheckResult = null | "latest" | "found" | "error";

type Ctx = {
  /** มีเวอร์ชันใหม่รออัปเดตอยู่ */
  needRefresh: boolean;
  /** ซ่อนแถบแจ้งเตือน (ยังไม่อัปเดตตอนนี้) */
  dismiss: () => void;
  /** โหลดเวอร์ชันใหม่แล้วเปิดแอปใหม่ */
  update: () => void;
  /** กดตรวจหาอัปเดตเอง */
  check: () => Promise<void>;
  checking: boolean;
  /** ผลการตรวจครั้งล่าสุด */
  result: CheckResult;
  supported: boolean;
};

const PwaCtx = createContext<Ctx | null>(null);

export function PwaProvider({ children }: { children: ReactNode }) {
  const reg = useRef<ServiceWorkerRegistration | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) { reg.current = r || null; },
  });

  const check = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setResult(null);
    try {
      const r = reg.current || (await navigator.serviceWorker?.getRegistration());
      if (!r) { setResult("error"); setChecking(false); return; }
      await r.update();
      // ให้เวลาเบราว์เซอร์ติดตั้งตัวใหม่สักครู่ แล้วค่อยสรุปผล
      await new Promise((res) => setTimeout(res, 1800));
      const fresh = Boolean(r.waiting || r.installing);
      setResult(fresh ? "found" : "latest");
    } catch {
      setResult("error");
    }
    setChecking(false);
  }, [checking]);

  return (
    <PwaCtx.Provider
      value={{
        needRefresh,
        dismiss: () => setNeedRefresh(false),
        update: () => updateServiceWorker(true),
        check,
        checking,
        result,
        supported: typeof navigator !== "undefined" && "serviceWorker" in navigator,
      }}
    >
      {children}
    </PwaCtx.Provider>
  );
}

export function usePwa(): Ctx {
  const v = useContext(PwaCtx);
  // เผื่อกรณีเรียกนอก Provider (เช่นตอนทดสอบ) — คืนค่าที่ไม่ทำอะไร แทนการพังทั้งแอป
  return (
    v || {
      needRefresh: false, dismiss: () => {}, update: () => {},
      check: async () => {}, checking: false, result: null, supported: false,
    }
  );
}
