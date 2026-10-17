import { useEffect, useState } from "react";

/** จอกว้างตั้งแต่ 1024px ขึ้นไป (คอม/แท็บเล็ตแนวนอน) = ใช้หน้าตาแบบเว็บเต็มจอ */
const QUERY = "(min-width: 1024px)";

export function useIsDesktop() {
  const [big, setBig] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const m = window.matchMedia(QUERY);
    const on = () => setBig(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return big;
}
