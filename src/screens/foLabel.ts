/**
 * FO Label — ฉลากสารเคมี ขนาดแนะนำ 210 x 145 mm (ลง A4 ได้ 1 แผ่น 2 ดวง)
 * หน้าตายึดตามแบบที่ให้มาเป๊ะ ๆ ห้ามเปลี่ยนโครง
 */

export type FoLabel = {
  id: string;
  code: string;
  name: string;
  gross_min: string;
  tare_min: string;
  net: string;
  mfg_date: string;
  bbe_date: string;
  batch_of: string;
  signal_word: "DANGER" | "WARNING";
  pictograms: string[];
  hp_codes: string | null;
  storage_text: string | null;
  customer_id: string | null;
  customer_name: string | null;
  note: string | null;
  width_mm: number;
  height_mm: number;
  created_at: string;
};

/** ขนาดแนะนำ (6 x 4 นิ้ว) */
/** ขนาดสติกเกอร์ที่แนะนำ — ลงกระดาษ A4 ได้แผ่นละ 2 ดวงพอดี */
export const FO_W = 210;
export const FO_H = 145;
/** สัดส่วนของ "แบบ" ตามภาพต้นแบบที่เจ้าของให้มา — ห้ามแก้
 *  ทุกตำแหน่งในฉลากอ้างอิงขนาดนี้ แล้วค่อยย่อ/ขยายทั้งแบบตามขนาดสติกเกอร์จริง */
export const REF_W = 152.4;
export const REF_H = 101.6;

/** ฉลากลง A4 (210x297) ได้กี่ดวง — คิดจากหน้ากระดาษเต็มใบ
 *  ขนาดแนะนำ 210x145 กว้างเท่ากระดาษพอดี ถ้าหักขอบกระดาษก่อนจะลงได้แค่ดวงเดียว */
export function foGrid(w: number, h: number) {
  const cols = Math.max(1, Math.floor(210 / w));
  const rows = Math.max(1, Math.floor(297 / h));
  return { cols, rows, per: cols * rows };
}
export const foPerSheet = (w: number, h: number) => foGrid(w, h).per;

/** สัญลักษณ์อันตรายมาตรฐาน GHS ทั้ง 9 แบบ — ไฟล์รูปอยู่ที่ /ghs/<code>.svg */
export const GHS = [
  { code: "GHS01", th: "ระเบิดได้" },
  { code: "GHS02", th: "ไวไฟ" },
  { code: "GHS03", th: "ช่วยให้ไฟลุก" },
  { code: "GHS04", th: "ก๊าซอัดความดัน" },
  { code: "GHS05", th: "กัดกร่อน" },
  { code: "GHS06", th: "พิษร้ายแรง" },
  { code: "GHS07", th: "ระคายเคือง" },
  { code: "GHS08", th: "อันตรายต่อสุขภาพ" },
  { code: "GHS09", th: "เป็นพิษต่อสิ่งแวดล้อม" },
] as const;

export const ghsUrl = (code: string) => `/ghs/${code}.svg`;

/** ค่าเริ่มต้นของบรรทัดล่าง — ตามภาพตัวอย่างที่ให้มา */
export const DEFAULT_HP =
  "H303 H315 H317 H318 H401 H412 P261 P302+P352 P305+P351+P338 P310 P312 P362+P364";
export const DEFAULT_STORAGE =
  "Store in the original, unopened packaging, away from light, heat, and humidity, at a temperature between 5 °C and 25 °C";

/* ---------- จำค่าล่าสุดที่กรอก เอาไว้เติมให้ใบถัดไป ---------- */
const LAST_HP = "ns_fo_last_hp";
const LAST_STORAGE = "ns_fo_last_storage";

export function lastHp() {
  try { return localStorage.getItem(LAST_HP) || DEFAULT_HP; } catch { return DEFAULT_HP; }
}
export function lastStorage() {
  try { return localStorage.getItem(LAST_STORAGE) || DEFAULT_STORAGE; } catch { return DEFAULT_STORAGE; }
}
export function rememberLines(hp: string, storage: string) {
  try {
    localStorage.setItem(LAST_HP, hp);
    localStorage.setItem(LAST_STORAGE, storage);
  } catch { /* เครื่องบางรุ่นปิดการเก็บข้อมูล ไม่เป็นไร */ }
}

/* ---------- วันที่ ---------- */
const MON = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

/** วันที่บนฉลาก แบบ 16 OCT 2026 (ตามภาพตัวอย่าง) */
export function foDate(d: string) {
  if (!d) return "-";
  const t = new Date(d + "T00:00:00");
  if (isNaN(t.getTime())) return "-";
  return `${String(t.getDate()).padStart(2, "0")} ${MON[t.getMonth()]} ${t.getFullYear()}`;
}

/** BBE = วันผลิต + 2 ปี วันที่เดียวกันเป๊ะ (คิดตามเวลาบ้านเรา ไม่ใช้เวลาสากล) */
export function plusTwoYears(d: string) {
  if (!d) return "";
  const t = new Date(d + "T00:00:00");
  if (isNaN(t.getTime())) return "";
  t.setFullYear(t.getFullYear() + 2);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export const foToday = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
