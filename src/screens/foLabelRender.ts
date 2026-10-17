/**
 * หน้าตาฉลาก FO Label — ใช้ชุดเดียวกันทั้งตอนดูตัวอย่างบนจอและตอนสร้าง PDF
 * ทุกระยะอ้างอิงตัวแปร --u (1 หน่วย = 1mm ตอนปริ้น) และ --s (ตัวคูณขนาดตัวหนังสือ)
 * ยึดตามแบบที่ให้มา ห้ามสลับตำแหน่ง
 */
import { FO_W, FO_H, foDate, ghsUrl, type FoLabel } from "./foLabel";
import { dataMatrixSVG } from "./Print";

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function foCSS(w: number, h: number, scope = "") {
  const S = scope ? `.${scope}` : "";
  const pad = +(Math.min(w, h) * 0.055).toFixed(3);
  const start = +Math.min(w / FO_W, h / FO_H).toFixed(3);
  const b = (base: number) => `calc(var(--u) * var(--s) * ${base})`; // base = mm ที่ขนาด 152.4x101.6
  const r = (n: number) => +n.toFixed(3);
  return `
  ${S}.fo{
    --s:${start};
    width:calc(var(--u) * ${r(w)}); height:calc(var(--u) * ${r(h)});
    padding:calc(var(--u) * ${pad});
    background:#fff; color:#111214; overflow:hidden;
    font-family:'IBM Plex Mono',ui-monospace,monospace;
    line-height:1.05;
  }
  /* บน = ข้อมูลซ้าย + สัญลักษณ์ขวา · ล่าง = Data Matrix + ข้อความกำกับยาวเต็มความกว้าง */
  ${S} .fo-fit{ display:flex; flex-direction:column; min-height:100% }
  ${S} .fo-top{ display:flex; gap:${b(4)}; flex:1 }
  ${S} .fo-left{ flex:1; min-width:0; display:flex; flex-direction:column }
  ${S} .fo-right{ flex:none; display:flex; flex-direction:column; align-items:center; justify-content:center }

  ${S} .fo-brand{ font-family:'Urbanist','Noto Sans Thai',sans-serif; font-weight:800; font-size:${b(11)}; letter-spacing:${b(-0.2)}; line-height:1 }
  ${S} .fo-code{ font-family:'Narin','Urbanist',sans-serif; font-weight:400; font-size:${b(6.2)}; margin-top:${b(5.5)}; line-height:1 }
  ${S} .fo-name{ font-family:'Narin','Urbanist',sans-serif; font-weight:400; font-size:${b(9.2)}; margin-top:${b(1.6)}; line-height:1.02; word-break:break-word }

  ${S} .fo-rows{
    margin-bottom:auto;
    display:grid; grid-template-columns:auto 1fr;
    column-gap:${b(4)}; row-gap:${b(1.1)};
    font-family:'IBM Plex Mono',ui-monospace,monospace;
    font-size:${b(3.9)}; margin-top:${b(7)};
  }
  ${S} .fo-rows .k{ font-weight:700 }

  ${S} .fo-bottom{ display:flex; align-items:flex-end; gap:${b(3)}; margin-top:${b(2)} }
  ${S} .fo-dm{ width:${b(13.5)}; height:${b(13.5)}; flex:none }
  ${S} .fo-dm svg{ width:100%; height:100%; display:block; shape-rendering:crispEdges }
  ${S} .fo-legal{
    flex:1; min-width:0;
    font-family:'IBM Plex Mono',ui-monospace,monospace;
    font-size:${b(2.35)}; line-height:1.45;
  }

  ${S} .fo-pics{ display:grid; grid-template-columns:repeat(2, ${b(23)}); gap:${b(1)} ${b(1.5)}; justify-items:center }
  ${S} .fo-pics.many{ grid-template-columns:repeat(3, ${b(18)}) }
  ${S} .fo-pics img{ width:100%; height:auto; display:block }
  ${S} .fo-pics .ph{ width:100%; aspect-ratio:1; border:${b(0.8)} solid #E5322A; transform:rotate(45deg) scale(.72) }
  ${S} .fo-signal{
    font-family:'IBM Plex Mono',ui-monospace,monospace;
    font-size:${b(4.2)}; letter-spacing:${b(0.3)}; margin:${b(0.6)} 0;
  }
  `;
}

/** ครึ่งบนของสัญลักษณ์ / คำสัญญาณ / ครึ่งล่าง — ให้ DANGER อยู่กลางระหว่างสองแถวเหมือนแบบ */
function picsHTML(item: FoLabel) {
  const codes = item.pictograms || [];
  if (!codes.length) return "";
  const many = codes.length > 4;
  const cls = many ? "fo-pics many" : "fo-pics";
  const cell = (c: string) => `<img src="${ghsUrl(c)}" alt="${esc(c)}" onerror="this.outerHTML='<div class=ph></div>'">`;
  const perRow = many ? 3 : 2;
  const half = Math.ceil(codes.length / 2 / perRow) * perRow;
  const top = codes.slice(0, half);
  const bottom = codes.slice(half);
  return `
    <div class="${cls}">${top.map(cell).join("")}</div>
    <div class="fo-signal">${esc(item.signal_word || "DANGER")}</div>
    ${bottom.length ? `<div class="${cls}">${bottom.map(cell).join("")}</div>` : ""}`;
}

export function foInnerHTML(item: FoLabel, dmScale = 6) {
  const svg = dataMatrixSVG(item.batch_of || "", dmScale);
  const row = (k: string, v: string) => `<div class="k">${k}</div><div>${esc(v)}</div>`;
  return `<div class="fo-fit">
  <div class="fo-top">
    <div class="fo-left">
      <div class="fo-brand">N SAVOIR</div>
      <div class="fo-code">${esc(item.code)}</div>
      <div class="fo-name">${esc(item.name)}</div>
      <div class="fo-rows">
        ${row("Gross min", item.gross_min)}
        ${row("Tare min", item.tare_min)}
        ${row("Net", item.net)}
        ${row("Manufactured", foDate(item.mfg_date))}
        ${row("BBE", foDate(item.bbe_date))}
        ${row("Batch (OF)", item.batch_of)}
      </div>
    </div>
    <div class="fo-right">${picsHTML(item)}</div>
  </div>
  <div class="fo-bottom">
    <div class="fo-dm">${svg}</div>
    <div class="fo-legal">
      <div>${esc(item.hp_codes || "")}</div>
      <div>${esc(item.storage_text || "")}</div>
    </div>
  </div>
</div>`;
}

/** วัดแล้วขยายตัวหนังสือให้เต็มกรอบ (ใช้ร่วมกับหน้าต่างปริ้นได้ด้วย) */
export const FO_FIT_FN = `
function fitFo(el) {
  var fit = el.querySelector('.fo-fit');
  if (!fit) return;
  var cur = function () {
    return parseFloat(el.style.getPropertyValue('--s')) ||
           parseFloat(getComputedStyle(el).getPropertyValue('--s')) || 1;
  };
  var tooWide = function () {
    var ns = fit.querySelectorAll('.fo-rows, .fo-legal, .fo-brand');
    for (var i = 0; i < ns.length; i++) {
      if (ns[i].scrollWidth > ns[i].clientWidth + 1) return true;
    }
    return false;
  };
  fit.style.minHeight = '0';
  for (var i = 0; i < 6; i++) {
    var cs = getComputedStyle(el);
    var availH = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var hh = fit.scrollHeight;
    if (!hh || availH <= 0) break;
    var c = cur();
    var next = Math.max(0.1, Math.min(6, c * (availH / hh) * 0.97));
    if (Math.abs(next - c) / c < 0.005) break;
    el.style.setProperty('--s', String(next));
  }
  for (var j = 0; j < 14 && tooWide(); j++) {
    el.style.setProperty('--s', String(cur() * 0.94));
  }
  // กันตกขอบล่าง: ถ้าข้อความยังสูงเกินกรอบ (เกิดจากบรรทัดล่างตัดขึ้นบรรทัดใหม่) ให้ย่อทีละนิดจนพอดี
  for (var k = 0; k < 24; k++) {
    var cs3 = getComputedStyle(el);
    var availH3 = el.clientHeight - parseFloat(cs3.paddingTop) - parseFloat(cs3.paddingBottom);
    if (availH3 <= 0 || fit.scrollHeight <= availH3 + 0.5) break;
    el.style.setProperty('--s', String(cur() * 0.98));
  }
  fit.style.minHeight = '';
}`;
