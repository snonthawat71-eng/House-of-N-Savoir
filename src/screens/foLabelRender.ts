/**
 * หน้าตาฉลาก FO Label — ใช้ชุดเดียวกันทั้งตอนดูตัวอย่างบนจอและตอนสร้าง PDF
 *
 * ทุกตัวเลขในไฟล์นี้วัดมาจากภาพต้นแบบที่เจ้าของส่งให้ (ไฟล์ขนาด 1800x1200 จุด = 152.4x101.6 มม.)
 * 1 จุดในภาพต้นแบบ = 0.0846667 มม.  ตัวเลขในวงเล็บคือค่าที่วัดได้จากภาพ (หน่วยเป็นจุด)
 *
 * วางทุกชิ้นแบบ "ตรึงตำแหน่ง" ตามต้นแบบ ไม่ยืดไม่หด ไม่สลับที่
 * ถ้าสติกเกอร์ขนาดอื่น ให้ย่อ/ขยายทั้งแบบตามสัดส่วนเดียวกัน (ตัวแปร s) แล้ววางกลางแผ่น
 */
import { REF_W, REF_H, foDate, ghsUrl, type FoLabel } from "./foLabel";
import { dataMatrixSVG } from "./Print";

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- ค่าคงที่ของแบบ (มม. อ้างอิงฉลาก 152.4 x 101.6) ---------- */
const LEFT = 8.047;        // (95)   ขอบซ้ายของข้อความทั้งหมด
const RIGHT = 8.128;       // (96)   ขอบขวาของกลุ่มสัญลักษณ์/ข้อความล่าง
const TEXT_MAXW = 83.0;    //        ความกว้างสูงสุดของ Code/Name/ตาราง ก่อนชนกลุ่มสัญลักษณ์

/* โลโก้ = ไฟล์ภาพลายเส้นของจริง (ห้ามพิมพ์เป็นตัวหนังสือ ฟอนต์จะไม่ตรง)
   ไฟล์ /logo-fo.svg กว้าง 504 สูง 120 หน่วย · แถวบน "N SAVOIR" สูง 73 หน่วย
   ตั้งให้แถวบนสูงเท่าเดิมกับต้นแบบ (6.054 มม.) และหัวตัวอักษรอยู่ที่เดิม */
const LOGO_X = 8.047;      // (95)
const LOGO_TOP = 12.784;   // (151)   ขอบบนรูป = หัวตัวอักษร N พอดี
const LOGO_W = 41.80;      // (504 หน่วย)
const LOGO_H = 9.95;       // (120 หน่วย)

const CODE_F = 5.658;      // (66.8)  ขนาดตัวอักษร Code
const CODE_TOP = 28.419;   // (335.7)
const CODE_X = 7.370;      // (87)

const NAME_F = 8.712;      // (102.9) ขนาดตัวอักษร Name (ใหญ่สุด)
const NAME_TOP = 35.306;   // (417)
const NAME_LS = -0.008;    //         (em)
const NAME_X = 7.454;      // (88)

const ROW_F = 2.824;       // (33.4)  ขนาดตัวอักษรในตาราง
const ROWS_TOP = 49.030;   // (579.1)
const ROW_PITCH = 3.400;   // (40.2)  ระยะห่างแต่ละบรรทัด
const COL1_W = 30.054;     // (355)   ความกว้างคอลัมน์ชื่อหัวข้อ

const DM_TOP = 75.861;     // (896)   Data Matrix มุมซ้ายล่าง
const DM_SIZE = 12.954;    // (153)

const LEG_X = 24.342;      // (287.5) ข้อความสองบรรทัดล่าง เริ่มถัดจาก Data Matrix
const LEG_MAXW = 120.5;    // (1423)  ยาวได้ถึงขอบขวา
const LEG1_F = 1.554;      // (18.4)  บรรทัด H/P
const LEG1_TOP = 85.240;   // (1006.8)
const LEG2_F = 1.685;      // (19.9)  บรรทัดวิธีเก็บรักษา
const LEG2_TOP = 87.171;   // (1029.6)

const PIC_TOP = 24.977;    // (295)   กลุ่มสัญลักษณ์ GHS
const PIC_CELL = 25.062;   // (296)   ขนาดสัญลักษณ์ 1 อัน
const PIC_GX = 1.185;      // (14)
const PIC_GY = 1.439;      // (17)
const PIC_CELL_M = 16.2;   //         ถ้าเลือกเกิน 4 อัน ใช้ 3 คอลัมน์ ย่อลงให้อยู่ในพื้นที่เดิม

const SIG_F = 2.782;       // (32.9)  คำว่า DANGER / WARNING
const SIG_LS = 0.038;      //         ระยะห่างตัวอักษร (em)
const SIG_TOP = 24.151;    // (285.3) นับจากขอบบนของกลุ่มสัญลักษณ์
const SIG_X = 0.508;       // (6)     เขยิบขวาให้ตรงต้นแบบ
const SIG_TOP_M = 15.53;   //         กรณีสัญลักษณ์ย่อ
const SIG_TOP_R1 = 25.5;   //         กรณีมีแถวเดียว ให้ลงมาอยู่ใต้สัญลักษณ์

export function foCSS(w: number, h: number, scope = "") {
  const S = scope ? `.${scope}` : "";
  const s = Math.min(w / REF_W, h / REF_H);
  const ox = (w - REF_W * s) / 2;
  const oy = (h - REF_H * s) / 2;
  const n = (v: number) => +v.toFixed(4);
  const U = (mm: number) => `calc(var(--u) * ${n(mm * s)})`;          // ความยาว/ขนาด
  const X = (mm: number) => `calc(var(--u) * ${n(ox + mm * s)})`;     // ตำแหน่งจากซ้าย
  const Y = (mm: number) => `calc(var(--u) * ${n(oy + mm * s)})`;     // ตำแหน่งจากบน
  const RX = (mm: number) => `calc(var(--u) * ${n(ox + mm * s)})`;    // ตำแหน่งจากขวา

  return `
  ${S}.fo{
    --s:${n(s)};
    position:relative; box-sizing:border-box;
    width:calc(var(--u) * ${n(w)}); height:calc(var(--u) * ${n(h)});
    background:#fff; color:#111214; overflow:hidden;
    font-family:'IBM Plex Mono',ui-monospace,monospace;
  }
  ${S} .fo-fit{ position:absolute; left:0; top:0; right:0; bottom:0 }
  ${S} .fo-fit *{ box-sizing:border-box }
  ${S} .fo-fit > *{ position:absolute }

  /* ---- โลโก้ (รูปจริง ไม่ใช่ตัวหนังสือ) ---- */
  ${S} .fo-brand{
    left:${X(LOGO_X)}; top:${Y(LOGO_TOP)};
    width:${U(LOGO_W)}; height:${U(LOGO_H)}; display:block;
  }

  /* ---- Code / Name ใช้ฟอนต์ Narin ---- */
  /* ห้ามใส่ overflow:hidden กับกล่องข้อความ — ตอนแปลงเป็นไฟล์ PDF บางเครื่อง
     จะตัดตัวอักษรขาดครึ่ง (กล่องสูงเท่าตัวอักษรพอดี) ความยาวคุมด้วยการย่อฟอนต์แทน */
  ${S} .fo-code, ${S} .fo-name{
    width:${U(TEXT_MAXW)};
    font-family:'Narin','Urbanist',sans-serif; font-weight:400;
    line-height:1; white-space:nowrap;
  }
  ${S} .fo-code{ left:${X(CODE_X)}; top:${Y(CODE_TOP)}; font-size:${U(CODE_F)} }
  ${S} .fo-name{ left:${X(NAME_X)}; top:${Y(NAME_TOP)}; font-size:${U(NAME_F)}; letter-spacing:${NAME_LS}em }

  /* ---- ตารางข้อมูล ---- */
  ${S} .fo-rows{
    left:${X(LEFT)}; top:${Y(ROWS_TOP)}; width:${U(TEXT_MAXW)};
    display:grid; grid-template-columns:${U(COL1_W)} 1fr;
    font-size:${U(ROW_F)}; line-height:1;
  }
  ${S} .fo-rows > div{
    height:${U(ROW_PITCH)}; white-space:nowrap;
  }
  ${S} .fo-rows .k{ font-weight:700 }

  /* ---- Data Matrix ---- */
  ${S} .fo-dm{
    left:${X(LEFT)}; top:${Y(DM_TOP)};
    width:${U(DM_SIZE)}; height:${U(DM_SIZE)};
  }
  ${S} .fo-dm svg{ width:100%; height:100%; display:block; shape-rendering:crispEdges }

  /* ---- สองบรรทัดล่าง: ตัวเล็ก บรรทัดละ 1 แถว ห้ามตัดลงบรรทัดใหม่ ---- */
  ${S} .fo-l1, ${S} .fo-l2{
    left:${X(LEG_X)}; width:${U(LEG_MAXW)};
    line-height:1; white-space:nowrap;
  }
  ${S} .fo-l1{ top:${Y(LEG1_TOP)}; font-size:${U(LEG1_F)} }
  ${S} .fo-l2{ top:${Y(LEG2_TOP)}; font-size:${U(LEG2_F)} }

  /* ---- กลุ่มสัญลักษณ์ GHS + คำสัญญาณ ---- */
  ${S} .fo-pics{ right:${RX(RIGHT)}; top:${Y(PIC_TOP)} }
  ${S} .fo-grid{
    display:grid; grid-template-columns:repeat(2, ${U(PIC_CELL)});
    column-gap:${U(PIC_GX)}; row-gap:${U(PIC_GY)};
  }
  ${S} .fo-pics.many .fo-grid{
    grid-template-columns:repeat(3, ${U(PIC_CELL_M)});
  }
  ${S} .fo-grid img{ width:100%; height:auto; display:block }
  ${S} .fo-grid .ph{ width:100%; aspect-ratio:1; border:${U(0.8)} solid #E5322A; transform:rotate(45deg) scale(.72) }
  ${S} .fo-signal{
    position:absolute; left:${U(SIG_X)}; right:0; top:${U(SIG_TOP)}; text-align:center;
    font-size:${U(SIG_F)}; letter-spacing:${SIG_LS}em; line-height:1; white-space:nowrap;
  }
  ${S} .fo-pics.many .fo-signal{ top:${U(SIG_TOP_M)} }
  ${S} .fo-pics.r1 .fo-signal{ top:${U(SIG_TOP_R1)} }
  `;
}

/** สัญลักษณ์ GHS: ไม่เกิน 4 อันเรียง 2 คอลัมน์เท่าต้นแบบ · เกินนั้นย่อเป็น 3 คอลัมน์ */
function picsHTML(item: FoLabel) {
  const codes = item.pictograms || [];
  const sig = esc(item.signal_word || "DANGER");
  if (!codes.length) return "";
  const many = codes.length > 4;
  const cols = many ? 3 : 2;
  const rows = Math.ceil(codes.length / cols);
  const cls = ["fo-pics", many ? "many" : "", rows < 2 ? "r1" : ""].filter(Boolean).join(" ");
  const cell = (c: string) =>
    `<img src="${ghsUrl(c)}" alt="${esc(c)}" onerror="this.outerHTML='<div class=ph></div>'">`;
  return `<div class="${cls}">
    <div class="fo-grid">${codes.map(cell).join("")}</div>
    <div class="fo-signal">${sig}</div>
  </div>`;
}

export function foInnerHTML(item: FoLabel, dmScale = 6) {
  const svg = dataMatrixSVG(item.batch_of || "", dmScale);
  const row = (k: string, v: string) => `<div class="k">${k}</div><div class="v">${esc(v)}</div>`;
  return `<div class="fo-fit">
  <img class="fo-brand" src="/logo-fo.svg" alt="N SAVOIR">
  <div class="fo-code"><span>${esc(item.code)}</span></div>
  <div class="fo-name"><span>${esc(item.name)}</span></div>
  <div class="fo-rows">
    ${row("Gross min", item.gross_min)}
    ${row("Tare min", item.tare_min)}
    ${row("Net", item.net)}
    ${row("Manufactured", foDate(item.mfg_date))}
    ${row("BBE", foDate(item.bbe_date))}
    ${row("Batch (OF)", item.batch_of)}
  </div>
  ${picsHTML(item)}
  <div class="fo-dm">${svg}</div>
  <div class="fo-l1"><span>${esc(item.hp_codes || "")}</span></div>
  <div class="fo-l2"><span>${esc(item.storage_text || "")}</span></div>
</div>`;
}

/**
 * ตำแหน่งทุกอย่างตรึงตามต้นแบบแล้ว หน้าที่เดียวที่เหลือคือ
 * "ถ้าข้อความยาวเกินช่องที่มี ให้ย่อเฉพาะบรรทัดนั้นลงจนพอดี" — ไม่ตัดขึ้นบรรทัดใหม่
 */
export const FO_FIT_FN = `
function fitFo(el) {
  var shrink = function (box) {
    if (!box) return;
    var sp = box.firstElementChild;
    if (!sp) return;
    box.style.fontSize = '';
    var avail = box.clientWidth;
    var nat = sp.offsetWidth || sp.scrollWidth;
    if (avail > 0 && nat > avail) {
      var f = parseFloat(getComputedStyle(box).fontSize);
      box.style.fontSize = (f * (avail / nat) * 0.995) + 'px';
    }
  };
  shrink(el.querySelector('.fo-code'));
  shrink(el.querySelector('.fo-name'));
  shrink(el.querySelector('.fo-l1'));
  shrink(el.querySelector('.fo-l2'));

  var rows = el.querySelector('.fo-rows');
  if (rows) {
    rows.style.fontSize = '';
    var cells = rows.children, k = 1;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (c.clientWidth > 0 && c.scrollWidth > c.clientWidth + 0.5) {
        k = Math.min(k, c.clientWidth / c.scrollWidth);
      }
    }
    if (k < 1) {
      rows.style.fontSize = (parseFloat(getComputedStyle(rows).fontSize) * k * 0.995) + 'px';
    }
  }
}`;
