/**
 * สร้าง PDF ของ FO Label
 * วิธี: เรนเดอร์ฉลากจริงในหน้าเว็บ (ชุด HTML/CSS เดียวกับตัวอย่าง) แล้วถ่ายเป็นภาพความละเอียดสูง
 *       วางลง PDF ตามขนาดมิลลิเมตรเป๊ะ — การันตีว่าหน้าตาตรงกับตัวอย่าง 100%
 */
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { FO_W, FO_H, type FoLabel } from "./foLabel";
import { foCSS, foInnerHTML, FO_FIT_FN } from "./foLabelRender";

const A4_W = 210;
const A4_H = 297;
const MARGIN = 5;
/** ความละเอียดภาพฉลาก (จุดต่อนิ้ว) — 350 คมพอสำหรับงานพิมพ์สติกเกอร์ */
const DPI = 350;

export type FoJob = { item: FoLabel; copies: number };

/** เรนเดอร์ฉลาก 1 ใบเป็นภาพ PNG ความละเอียดสูง */
async function renderLabel(item: FoLabel): Promise<string> {
  const W = Number(item.width_mm) || FO_W;
  const H = Number(item.height_mm) || FO_H;
  const pxPerMm = DPI / 25.4;

  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-99999px;top:0;z-index:-1";
  holder.innerHTML = `<style>${foCSS(W, H, "foshot")}</style>
    <div class="foshot fo" style="--u:${pxPerMm}px">${foInnerHTML(item, 10)}</div>`;
  document.body.appendChild(holder);

  const el = holder.querySelector(".fo") as HTMLElement;
  try {
    // รอฟอนต์ + รูปสัญลักษณ์โหลดเสร็จก่อน ไม่งั้นภาพออกมาผิด
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all([...holder.querySelectorAll("img")].map((img) =>
      img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; })));
    // วัดแล้วขยายตัวหนังสือให้เต็มกรอบ (ชุดเดียวกับตัวอย่าง)
    // eslint-disable-next-line no-new-func
    new Function(`${FO_FIT_FN}; fitFo(arguments[0]);`)(el);

    const canvas = await html2canvas(el, {
      scale: 1,                       // ตั้ง --u เป็นพิกเซลต่อมิลลิเมตรไว้แล้ว
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
      width: el.offsetWidth,
      height: el.offsetHeight,
    });
    return canvas.toDataURL("image/png");
  } finally {
    holder.remove();
  }
}

/** จำนวนฉลากที่ลงได้ 1 แผ่น A4 */
export function foPerSheet(w: number, h: number) {
  return Math.max(1, Math.floor((A4_W - MARGIN * 2) / w)) *
         Math.max(1, Math.floor((A4_H - MARGIN * 2) / h));
}

export async function buildFoPdf(jobs: FoJob[], mode: "a4" | "label") {
  const list = jobs.filter((j) => j.copies > 0);
  if (!list.length) throw new Error("ไม่มีรายการให้ปริ้น");
  const first = list[0].item;
  const W = Number(first.width_mm) || FO_W;
  const H = Number(first.height_mm) || FO_H;

  // เรนเดอร์ภาพทีละแบบ (ใบซ้ำใช้ภาพเดิม ไม่ต้องเรนเดอร์ใหม่)
  const imgs = new Map<string, string>();
  for (const { item } of list) {
    if (!imgs.has(item.id)) imgs.set(item.id, await renderLabel(item));
  }

  const seq: FoLabel[] = [];
  list.forEach(({ item, copies }) => { for (let i = 0; i < copies; i++) seq.push(item); });

  if (mode === "label") {
    const orient = W >= H ? "landscape" : "portrait";
    const doc = new jsPDF({ unit: "mm", format: [W, H], orientation: orient });
    seq.forEach((it, i) => {
      if (i > 0) doc.addPage([W, H], orient);
      doc.addImage(imgs.get(it.id)!, "PNG", 0, 0, W, H);
    });
    return doc;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cols = Math.max(1, Math.floor((A4_W - MARGIN * 2) / W));
  const rowsPerPage = Math.max(1, Math.floor((A4_H - MARGIN * 2) / H));
  const perPage = cols * rowsPerPage;
  const x0 = (A4_W - cols * W) / 2;

  seq.forEach((it, i) => {
    const onPage = i % perPage;
    if (i > 0 && onPage === 0) doc.addPage("a4", "portrait");
    const r = Math.floor(onPage / cols);
    const c = onPage % cols;
    const leftOnPage = Math.min(perPage, seq.length - (i - onPage));
    const rowsThisPage = Math.ceil(leftOnPage / cols);
    const y0 = (A4_H - rowsThisPage * H) / 2;
    doc.addImage(imgs.get(it.id)!, "PNG", x0 + c * W, y0 + r * H, W, H);
  });
  return doc;
}

export async function openFoPdf(jobs: FoJob[], mode: "a4" | "label") {
  const doc = await buildFoPdf(jobs, mode);
  const f = jobs[0].item;
  const base = jobs.length === 1
    ? `fo-${(f.batch_of || "label").replace(/[^\w.-]/g, "")}`
    : `fo-รวม${jobs.length}รายการ`;
  doc.save(`${base}-${f.width_mm}x${f.height_mm}mm.pdf`);
}
