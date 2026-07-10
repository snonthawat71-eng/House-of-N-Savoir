/* โทนสี/ฟอนต์กลางของแอป — ใช้ร่วมกันทุกหน้า */
export const C = {
  bg: "#F1F2F4", card: "#FFFFFF",
  ink: "#111214", ink2: "#1A1B1E",
  sub: "#8A8F98", line: "#EAECEF",
  red: "#E5322A", redSoft: "#FDECEA",
  green: "#16A45C", greenSoft: "#E7F5EE",
};
export const SHADOW = "0 1px 2px rgba(17,18,20,.04), 0 8px 24px rgba(17,18,20,.06)";
export const SHADOW_SM = "0 1px 2px rgba(17,18,20,.05), 0 4px 12px rgba(17,18,20,.05)";
export const disp = "'Plus Jakarta Sans', system-ui, sans-serif";
export const sans = "'Inter', system-ui, sans-serif";
export const mono = "'Space Mono', ui-monospace, monospace";
export const baht = (n: number | null | undefined) =>
  n == null ? "-" : "฿" + Number(n).toLocaleString("th-TH");
export const inputStyle = {
  background: C.bg, border: "none", outline: "none", fontSize: 14, color: C.ink,
} as const;
export const fmtDate = (iso?: string | null) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });
  } catch { return iso; }
};
export const daysUntil = (iso?: string | null) => {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return d;
};
