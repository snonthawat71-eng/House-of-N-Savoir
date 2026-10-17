/**
 * สร้างไฟล์ PDF สติกเกอร์ขนาดเป๊ะเป็นมิลลิเมตร
 * ทำเป็น PDF เพราะสั่งพิมพ์หน้าเว็บจากมือถือ ขนาดจะเพี้ยนและมี URL/วันที่ติดมาท้ายกระดาษ
 */
import { jsPDF } from "jspdf";
import { toCanvas } from "bwip-js/browser";
import type { BatchLabel } from "./Print";
import { dmPayload } from "./Print";

/* ---------- ค่าคงที่การจัดหน้า (มิลลิเมตร) ---------- */
const A4_W = 210;
const A4_H = 297;
/** เส้นขอบดำห่างจากขอบกระดาษเท่านี้ */
const MARGIN = 5;

/* ---------- ตัวช่วย ---------- */
const fmtDate = (d: string) => {
  if (!d) return "-";
  const t = new Date(d + "T00:00:00");
  if (isNaN(t.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getDate())}.${p(t.getMonth() + 1)}.${t.getFullYear()}`;
};

/** วาด Data Matrix ลง PDF (เรนเดอร์ละเอียดสูงก่อน จะได้คมพอให้เครื่องสแกนอ่านออก) */
async function dmDataUrl(text: string): Promise<string | null> {
  if (!text) return null;
  try {
    const cv = document.createElement("canvas");
    await toCanvas(cv, { bcid: "datamatrix", text, scale: 10, padding: 0 });
    return cv.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** โหลดโลโก้เป็นรูปสำหรับฝังใน PDF */
async function logoDataUrl(): Promise<{ url: string; ratio: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `${window.location.origin}/logo-mark.png`;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    const cv = document.createElement("canvas");
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.getContext("2d")!.drawImage(img, 0, 0);
    return { url: cv.toDataURL("image/png"), ratio: img.naturalWidth / img.naturalHeight };
  } catch {
    return null;
  }
}

/**
 * วาดสติกเกอร์ 1 ดวงลงบน PDF ที่ตำแหน่ง (x, y) ขนาด w x h (มิลลิเมตร)
 * ตัวหนังสือย่อ/ขยายตามขนาดสติกเกอร์ และตัดบรรทัดเองถ้าชื่อยาว
 */
function drawLabel(
  doc: jsPDF, item: BatchLabel, x: number, y: number, w: number, h: number,
  dm: string | null, logo: { url: string; ratio: number } | null,
) {
  const withDM = item.show_dm !== false && !!dm;
  const withLogo = item.show_logo !== false && !!logo;

  const pad = Math.min(w, h) * 0.075;
  const innerW = w - pad * 2;

  // ขนาดตัวหนังสืออ้างอิงที่สติกเกอร์ 80x50mm แล้วคูณตามขนาดจริง
  let k = Math.min(w / 80, h / 50);
  const mm2pt = 72 / 25.4;

  const dmSize = withDM ? Math.min(h - pad * 2, 11.5 * k) : 0;
  const dmGap = withDM ? 2 * k : 0;
  const textW = innerW - dmSize - dmGap;

  /** คำนวณความสูงรวมของข้อความที่ตัวคูณหนึ่ง ๆ เพื่อหาค่าที่พอดีกรอบ */
  const measure = (s: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.6 * s * mm2pt);
    const titleLines = doc.splitTextToSize(item.title || "", textW).length;
    const lh = 1.08;
    let H = 4.6 * s * lh * titleLines;
    if (item.code) H += 0.9 * s + 2.7 * s * lh;
    H += 2.6 * s + (2.7 * s * lh * 4 + 0.9 * s * 3);
    if (withLogo) H += 2 * s + 3.6 * s;
    return H;
  };

  const availH = h - pad * 2;
  for (let i = 0; i < 6; i++) {
    const got = measure(k);
    if (!got) break;
    const next = Math.max(0.1, Math.min(6, k * (availH / got) * 0.98));
    if (Math.abs(next - k) / k < 0.005) break;
    k = next;
  }

  // กรอบนอก
  doc.setDrawColor(17, 18, 20);
  doc.setLineWidth(Math.max(0.12, pad * 0.1));
  doc.rect(x, y, w, h);

  doc.setTextColor(17, 18, 20);
  let cy = y + pad;

  // ชื่อรายการ
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.6 * k * mm2pt);
  const lines: string[] = doc.splitTextToSize(item.title || "", textW);
  lines.forEach((ln) => {
    cy += 4.6 * k * 0.82;                       // เลื่อนลงมาที่เส้นฐานตัวอักษร
    doc.text(ln, x + pad, cy);
    cy += 4.6 * k * 0.26;
  });

  // CODE
  doc.setFont("helvetica", "normal");
  doc.setFontSize(2.7 * k * mm2pt);
  if (item.code) {
    cy += 0.9 * k + 2.7 * k * 0.82;
    const lbl = "CODE :";
    doc.text(lbl, x + pad, cy);
    doc.text(String(item.code), x + pad + doc.getTextWidth(lbl) + 2.2 * k, cy);
    cy += 2.7 * k * 0.26;
  }

  // ตารางข้อมูล — จัดเครื่องหมาย : ให้ตรงกันทุกบรรทัด
  const rows: [string, string][] = [
    ["BATCH NO.", item.batch_no],
    ["MFG. DATE", fmtDate(item.mfg_date)],
    ["EXP. DATE", fmtDate(item.exp_date)],
    ["QUANTITY", String(item.quantity ?? "")],
  ];
  const keyW = Math.max(...rows.map(([key]) => doc.getTextWidth(key)));
  cy += 2.6 * k;
  rows.forEach(([key, val]) => {
    cy += 2.7 * k * 0.82;
    doc.text(key, x + pad, cy);
    doc.text(":", x + pad + keyW + 2.2 * k, cy);
    doc.text(val, x + pad + keyW + 2.2 * k * 2.4, cy);
    cy += 2.7 * k * 0.26 + 0.9 * k;
  });

  // โลโก้ + ชื่อแบรนด์ (มุมล่างซ้าย)
  if (withLogo && logo) {
    const lh = 3.6 * k;
    const ly = y + h - pad - lh;
    doc.addImage(logo.url, "PNG", x + pad, ly, lh * logo.ratio, lh);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(1.8 * k * mm2pt);
    doc.text("HOUSE OF N SAVOIR", x + pad + lh * logo.ratio + 1.75 * k, ly + lh * 0.72);
  }

  // Data Matrix (มุมล่างขวา)
  if (withDM && dm) {
    doc.addImage(dm, "PNG", x + w - pad - dmSize, y + h - pad - dmSize, dmSize, dmSize);
  }
}

/* ---------- สร้าง PDF ---------- */

export type PdfMode = "a4" | "label";

/**
 * a4    = เรียงหลายดวงลงกระดาษ A4 ขอบซ้ายขวา/บนล่างชนกัน (ตัดครั้งเดียวได้ 2 ดวง)
 * label = 1 ดวง 1 หน้า ขนาดเท่าสติกเกอร์เป๊ะ สำหรับเครื่องพิมพ์สติกเกอร์
 */
export async function buildLabelPdf(item: BatchLabel, copies: number, mode: PdfMode) {
  const W = Number(item.width_mm) || 80;
  const H = Number(item.height_mm) || 50;
  const dm = item.show_dm !== false ? await dmDataUrl(dmPayload(item.code, item.batch_no)) : null;
  const logo = item.show_logo !== false ? await logoDataUrl() : null;

  if (mode === "label") {
    const doc = new jsPDF({ unit: "mm", format: [W, H], orientation: W >= H ? "landscape" : "portrait" });
    for (let i = 0; i < copies; i++) {
      if (i > 0) doc.addPage([W, H], W >= H ? "landscape" : "portrait");
      drawLabel(doc, item, 0, 0, W, H, dm, logo);
    }
    return doc;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  // ขอบสติกเกอร์ชนกันพอดี ไม่เว้นช่องไฟ -> เส้นขอบซ้อนกัน ตัดทีเดียวได้ 2 ดวง
  const cols = Math.max(1, Math.floor((A4_W - MARGIN * 2) / W));
  const rowsPerPage = Math.max(1, Math.floor((A4_H - MARGIN * 2) / H));
  const perPage = cols * rowsPerPage;
  // จัดบล็อกทั้งหมดให้อยู่กลางหน้ากระดาษ
  const x0 = (A4_W - cols * W) / 2;

  for (let i = 0; i < copies; i++) {
    const onPage = i % perPage;
    if (i > 0 && onPage === 0) doc.addPage("a4", "portrait");
    const r = Math.floor(onPage / cols);
    const c = onPage % cols;
    const rowsThisPage = Math.min(rowsPerPage, Math.ceil((copies - (i - onPage)) / cols));
    const y0 = (A4_H - rowsThisPage * H) / 2;
    drawLabel(doc, item, x0 + c * W, y0 + r * H, W, H, dm, logo);
  }
  return doc;
}

/** เปิดไฟล์ PDF ให้ผู้ใช้ (มือถือจะเด้งหน้าดู/แชร์/สั่งพิมพ์) */
export async function openLabelPdf(item: BatchLabel, copies: number, mode: PdfMode) {
  const doc = await buildLabelPdf(item, copies, mode);
  const name = `batch-${(item.batch_no || "label").replace(/[^\w.-]/g, "")}-${item.width_mm}x${item.height_mm}mm.pdf`;
  doc.save(name);
}
