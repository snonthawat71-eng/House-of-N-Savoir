/**
 * ค้นหาทั้งระบบ — พิมพ์ค้น หรือยิงโค้ดจากเครื่องสแกน / กล้องมือถือก็ได้
 * ค้นข้ามทุกหมวดที่ผู้ใช้คนนั้นมีสิทธิ์เห็น (หมวดที่ไม่มีสิทธิ์จะไม่ถูกค้นเลย)
 * สูตรกลิ่น (Formula Lab) ไม่ถูกค้นในนี้ เพราะเป็นข้อมูลลับเฉพาะเจ้าของ
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search as SearchIcon, ScanLine, X, Loader2, Languages, ChevronRight, ArrowUpRight } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, mono, inputStyle, fmtDate, baht } from "../lib/ui";
import { hasThai, thaiToEn, makeBurstDetector } from "../lib/thaikey";
import { CameraScan } from "../lib/scan";

type Row = Record<string, unknown>;
type Hit = {
  key: string; group: string; title: string; sub: string;
  screen: string | null; fields: [string, string][];
  table: string; id: string;
};

const s = (v: unknown) => (v == null || v === "" ? "" : String(v));
const num = (v: unknown) => (v == null ? "-" : String(v));

/** รายการที่จะเอาไปค้น — ชื่อตาราง, ช่องที่ค้น, สิทธิ์ที่ต้องมี, วิธีแสดงผล */
type Src = {
  key: string; table: string; group: string; cols: string; search: string[];
  need?: string[];                       // ต้องมีสิทธิ์หมวดใดหมวดหนึ่งในนี้
  title: (r: Row) => string;
  sub: (r: Row) => string;
  screen?: (r: Row) => string | null;
  fields: (r: Row) => [string, string][];
};

const SOURCES: Src[] = [
  {
    key: "product", table: "products_view", group: "สินค้า",
    cols: "id,sku,name,type,size,retail,stock", search: ["sku", "name", "type", "size"],
    title: (r) => s(r.name) || s(r.sku),
    sub: (r) => [s(r.sku), s(r.size), s(r.type)].filter(Boolean).join(" · "),
    fields: (r) => [["รหัสสินค้า", s(r.sku)], ["ชื่อ", s(r.name)], ["ประเภท", s(r.type)],
      ["ขนาด", s(r.size) || "-"], ["ราคาขาย", baht(r.retail as number)], ["คงเหลือ", num(r.stock)]],
  },
  {
    key: "brand", table: "brands", group: "แบรนด์",
    cols: "id,name,created_at", search: ["name"],
    title: (r) => s(r.name), sub: () => "แบรนด์สินค้า",
    fields: (r) => [["ชื่อแบรนด์", s(r.name)], ["เพิ่มเมื่อ", fmtDate(s(r.created_at))]],
  },
  {
    key: "customer", table: "customers", group: "ลูกค้า",
    cols: "id,name,kind,contact,credit_terms,note", search: ["name", "contact", "note"],
    need: ["b2b", "b2c", "office"],
    title: (r) => s(r.name),
    sub: (r) => [s(r.kind).toUpperCase(), s(r.contact)].filter(Boolean).join(" · "),
    screen: (r) => (s(r.kind) === "b2c" ? "b2c" : "b2b"),
    fields: (r) => [["ชื่อ", s(r.name)], ["ประเภท", s(r.kind).toUpperCase()],
      ["ติดต่อ", s(r.contact) || "-"], ["เครดิต", s(r.credit_terms) || "-"], ["หมายเหตุ", s(r.note) || "-"]],
  },
  {
    key: "order", table: "orders", group: "ออเดอร์",
    cols: "id,customer_name,kind,status,total,note,created_at", search: ["customer_name", "status", "note"],
    need: ["b2b", "b2c", "office"],
    title: (r) => s(r.customer_name) || "ออเดอร์",
    sub: (r) => [s(r.kind).toUpperCase(), s(r.status), fmtDate(s(r.created_at))].filter(Boolean).join(" · "),
    screen: (r) => (s(r.kind) === "b2c" ? "b2c" : "b2b"),
    fields: (r) => [["ลูกค้า", s(r.customer_name)], ["ประเภท", s(r.kind).toUpperCase()],
      ["สถานะ", s(r.status)], ["ยอดรวม", baht(r.total as number)], ["วันที่", fmtDate(s(r.created_at))],
      ["หมายเหตุ", s(r.note) || "-"]],
  },
  {
    key: "quote", table: "quotations", group: "ใบเสนอราคา",
    cols: "id,number,customer_name,total,status,created_at", search: ["number", "customer_name", "status"],
    need: ["b2b", "office"],
    title: (r) => s(r.number) || "ใบเสนอราคา",
    sub: (r) => [s(r.customer_name), s(r.status)].filter(Boolean).join(" · "),
    screen: () => "b2b",
    fields: (r) => [["เลขที่", s(r.number)], ["ลูกค้า", s(r.customer_name)],
      ["ยอดรวม", baht(r.total as number)], ["สถานะ", s(r.status)], ["วันที่", fmtDate(s(r.created_at))]],
  },
  {
    key: "sample", table: "samples", group: "ตัวอย่างที่ส่ง",
    cols: "id,customer_name,item,sent_date,tracking,status", search: ["customer_name", "item", "tracking", "status"],
    need: ["b2b", "office"],
    title: (r) => s(r.item) || "ตัวอย่าง",
    sub: (r) => [s(r.customer_name), s(r.tracking)].filter(Boolean).join(" · "),
    screen: () => "b2b",
    fields: (r) => [["สินค้า", s(r.item)], ["ลูกค้า", s(r.customer_name)],
      ["ส่งเมื่อ", fmtDate(s(r.sent_date))], ["เลขพัสดุ", s(r.tracking) || "-"], ["สถานะ", s(r.status)]],
  },
  {
    key: "supplier", table: "suppliers", group: "ผู้ผลิต/ซัพพลายเออร์",
    cols: "id,name,material,contact,contract_end,note", search: ["name", "material", "contact", "note"],
    need: ["supplier", "office"],
    title: (r) => s(r.name),
    sub: (r) => [s(r.material), s(r.contact)].filter(Boolean).join(" · "),
    screen: () => "supplier",
    fields: (r) => [["ชื่อ", s(r.name)], ["วัตถุดิบ", s(r.material) || "-"],
      ["ติดต่อ", s(r.contact) || "-"], ["สัญญาหมดอายุ", fmtDate(s(r.contract_end))], ["หมายเหตุ", s(r.note) || "-"]],
  },
  {
    key: "po", table: "purchase_orders", group: "ใบสั่งซื้อ (PO)",
    cols: "id,number,supplier_name,total,status,created_at", search: ["number", "supplier_name", "status"],
    need: ["supplier", "office"],
    title: (r) => s(r.number) || "PO",
    sub: (r) => [s(r.supplier_name), s(r.status)].filter(Boolean).join(" · "),
    screen: () => "supplier",
    fields: (r) => [["เลขที่", s(r.number)], ["ผู้ผลิต", s(r.supplier_name)],
      ["ยอดรวม", baht(r.total as number)], ["สถานะ", s(r.status)], ["วันที่", fmtDate(s(r.created_at))]],
  },
  {
    key: "batch", table: "batch_labels", group: "Batch Label",
    cols: "id,title,code,batch_no,mfg_date,exp_date,quantity,customer_name",
    search: ["batch_no", "code", "title", "customer_name"],
    need: ["office"],
    title: (r) => s(r.title) || s(r.batch_no),
    sub: (r) => `BATCH ${s(r.batch_no)}${r.code ? " · " + s(r.code) : ""}`,
    screen: () => "print",
    fields: (r) => [["ชื่อรายการ", s(r.title)], ["CODE", s(r.code) || "-"], ["BATCH NO.", s(r.batch_no)],
      ["วันผลิต", fmtDate(s(r.mfg_date))], ["วันหมดอายุ", fmtDate(s(r.exp_date))],
      ["จำนวน", s(r.quantity) || "-"], ["ลูกค้า", s(r.customer_name) || "-"]],
  },
  {
    key: "fo", table: "fo_labels", group: "FO Label",
    cols: "id,code,name,batch_of,mfg_date,bbe_date,net,customer_name",
    search: ["batch_of", "code", "name", "customer_name"],
    need: ["office"],
    title: (r) => s(r.name) || s(r.code),
    sub: (r) => `${s(r.code)} · BATCH ${s(r.batch_of)}`,
    screen: () => "print",
    fields: (r) => [["Code", s(r.code)], ["Name", s(r.name)], ["Batch (OF)", s(r.batch_of)],
      ["Net", s(r.net) || "-"], ["Manufactured", fmtDate(s(r.mfg_date))], ["BBE", fmtDate(s(r.bbe_date))],
      ["ลูกค้า", s(r.customer_name) || "-"]],
  },
  {
    key: "shop", table: "stock_locations", group: "ร้าน/คลัง",
    cols: "id,name,kind,shop_name,branch_name,branch_code,phone",
    search: ["name", "shop_name", "branch_name", "branch_code", "phone"],
    need: ["b2c", "office"],
    title: (r) => s(r.shop_name) || s(r.name),
    sub: (r) => [s(r.branch_name), s(r.kind)].filter(Boolean).join(" · "),
    screen: () => "b2c",
    fields: (r) => [["ชื่อ", s(r.shop_name) || s(r.name)], ["สาขา", s(r.branch_name) || "-"],
      ["รหัสสาขา", s(r.branch_code) || "-"], ["ประเภท", s(r.kind)], ["โทร", s(r.phone) || "-"]],
  },
  {
    key: "campaign", table: "campaigns", group: "การตลาด",
    cols: "id,name,channel,status,note", search: ["name", "channel", "status", "note"],
    need: ["b2c", "office"],
    title: (r) => s(r.name),
    sub: (r) => [s(r.channel), s(r.status)].filter(Boolean).join(" · "),
    screen: () => "b2c",
    fields: (r) => [["ชื่อแคมเปญ", s(r.name)], ["ช่องทาง", s(r.channel) || "-"],
      ["สถานะ", s(r.status)], ["หมายเหตุ", s(r.note) || "-"]],
  },
];

/** ตัดตัวอักษรที่ทำให้คำสั่งค้นหาของฐานข้อมูลพัง */
const safe = (q: string) => q.replace(/[,()%*\\"']/g, " ").replace(/\s+/g, " ").trim();

export default function SearchScreen({ mods, go, autoScan }: { mods: string[]; go: (s: string) => void; autoScan?: boolean }) {
  const [raw, setRaw] = useState("");
  const [scanned, setScanned] = useState("");      // ข้อความที่แปลงจากคีย์บอร์ดไทยแล้ว
  const [thaiWarn, setThaiWarn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [cam, setCam] = useState(false);
  const burst = useRef(makeBurstDetector());
  const prevLen = useRef(0);
  const box = useRef<HTMLInputElement>(null);

  // กดปุ่มสแกนจากหน้าแรก → เปิดกล้องให้เลย
  useEffect(() => { if (autoScan) setCam(true); }, [autoScan]);

  useBackHandler(cam || Boolean(open), () => { if (cam) setCam(false); else setOpen(null); });

  /** ข้อความที่ใช้ค้นจริง */
  const term = scanned || raw;

  const onChange = (v: string) => {
    const isBurst = burst.current.feed(v.length, prevLen.current);
    prevLen.current = v.length;
    setRaw(v);
    setOpen(null);
    // ยิงสแกนมาแต่คีย์บอร์ดเป็นไทย → เตือน + แปลงกลับให้ค้นต่อได้
    if (isBurst && hasThai(v)) {
      setThaiWarn(true);
      setScanned(thaiToEn(v));
    } else {
      setThaiWarn(false);
      setScanned("");
    }
  };

  const clear = () => {
    setRaw(""); setScanned(""); setThaiWarn(false); setHits([]); setOpen(null);
    prevLen.current = 0; burst.current.reset(); box.current?.focus();
  };

  const run = useCallback(async (q: string) => {
    const base = safe(q);
    // Data Matrix ของเราเก็บเป็น "CODE|BATCH" — แยกค้นทีละท่อน
    const parts = [...new Set([base, ...base.split("|").map((x) => x.trim())])].filter((x) => x.length >= 2);
    if (!parts.length) { setHits([]); return; }
    setBusy(true);
    const usable = SOURCES.filter((src) => !src.need || src.need.some((m) => mods.includes(m)));
    const jobs = usable.map(async (src) => {
      const or = parts.flatMap((p) => src.search.map((c) => `${c}.ilike.%${p}%`)).join(",");
      const { data } = await supabase.from(src.table).select(src.cols).or(or).limit(8);
      return (data || []).map((r) => {
        const row = r as unknown as Row;
        return {
          key: `${src.key}:${s(row.id)}`, group: src.group, table: src.table, id: s(row.id),
          title: src.title(row) || "(ไม่มีชื่อ)", sub: src.sub(row),
          screen: src.screen ? src.screen(row) : null, fields: src.fields(row),
        } as Hit;
      });
    });
    const out = await Promise.allSettled(jobs);
    setHits(out.flatMap((r) => (r.status === "fulfilled" ? r.value : [])));
    setBusy(false);
  }, [mods]);

  // ค้นแบบหน่วงเวลาเล็กน้อย กันยิงคำสั่งถี่เกินตอนพิมพ์
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const t = term.trim();
    if (t.length < 2) { setHits([]); setBusy(false); return; }
    const id = window.setTimeout(() => void run(t), 280);
    return () => window.clearTimeout(id);
  }, [term, run]);

  const groups = useMemo(() => {
    const g = new Map<string, Hit[]>();
    hits.forEach((h) => { const a = g.get(h.group) || []; a.push(h); g.set(h.group, a); });
    return [...g.entries()];
  }, [hits]);

  const openHit = (h: Hit) => {
    const next = open === h.key ? null : h.key;
    setOpen(next);
    if (next) void logAudit({ action: "view", entity: h.table, entityId: h.id, newValue: { from: "ค้นหาทั้งระบบ" } });
  };

  return (
    <div className="px-5 pb-24">
      {/* ช่องค้นหา */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm">
          <SearchIcon size={16} className="shrink-0 text-muted-foreground" />
          <input
            ref={box}
            autoFocus
            value={raw}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void run(term.trim()); } }}
            placeholder="ค้นหา หรือยิงโค้ดตรงนี้…"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: C.ink, boxShadow: "none", border: "none" }}
          />
          {raw && (
            <button onClick={clear} aria-label="ล้าง" className="shrink-0 text-muted-foreground">
              <X size={16} />
            </button>
          )}
        </div>
        <button onClick={() => setCam(true)} aria-label="สแกนด้วยกล้อง"
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
          <ScanLine size={18} />
        </button>
      </div>

      {/* เตือนคีย์บอร์ดภาษาไทย */}
      {thaiWarn && (
        <div className="mt-3 rounded-2xl p-3.5" style={{ background: C.redSoft, border: `1px solid ${C.red}33` }}>
          <div className="flex items-start gap-2.5">
            <Languages size={17} className="mt-[1px] shrink-0" style={{ color: C.red }} />
            <div className="min-w-0 text-[12.5px] leading-relaxed" style={{ color: C.ink }}>
              <b style={{ color: C.red }}>คีย์บอร์ดเป็นภาษาไทยอยู่</b> — เครื่องสแกนพิมพ์ได้แค่ภาษาอังกฤษ
              ตัวหนังสือเลยเพี้ยน <b>กดเปลี่ยนคีย์บอร์ดเป็นภาษาอังกฤษ (EN) แล้วยิงใหม่</b>
              <div className="mt-1.5 text-[11.5px] text-muted-foreground">
                ตอนนี้แปลงกลับให้ชั่วคราวแล้วเป็น <b style={{ fontFamily: mono, color: C.ink }}>{scanned}</b> และค้นให้เลย
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ผลลัพธ์ */}
      <div className="mt-4">
        {!isSupabaseConfigured ? (
          <p className="py-10 text-center text-[12.5px] text-muted-foreground">โหมดเดโม — ยังไม่ได้ต่อฐานข้อมูล</p>
        ) : term.trim().length < 2 ? (
          <div className="py-10 text-center">
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              พิมพ์ชื่อสินค้า ลูกค้า เลข batch เลขใบเสนอราคา หรือเลข PO<br />
              จะยิงด้วยเครื่องสแกน หรือกดปุ่มกล้องสแกน Data Matrix ก็ได้
            </p>
          </div>
        ) : busy && !hits.length ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>
        ) : !hits.length ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            ไม่พบ “<b style={{ color: C.ink }}>{term.trim()}</b>” ในระบบ
          </p>
        ) : (
          groups.map(([g, list]) => (
            <div key={g} className="mb-5">
              <div className="mb-2 flex items-center gap-2">
                <div className="font-disp text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{g}</div>
                <div className="text-[11px] text-muted-foreground">{list.length}</div>
              </div>
              {list.map((h) => (
                <div key={h.key} className="mb-2 overflow-hidden rounded-2xl bg-card shadow-sm">
                  <button onClick={() => openHit(h)} className="flex w-full items-center gap-3 p-3.5 text-left">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-bold" style={{ color: C.ink }}>{h.title}</div>
                      {h.sub && <div className="truncate text-[11.5px] text-muted-foreground" style={{ fontFamily: mono }}>{h.sub}</div>}
                    </div>
                    <ChevronRight size={16}
                      className="shrink-0 text-muted-foreground transition-transform"
                      style={{ transform: open === h.key ? "rotate(90deg)" : "none" }} />
                  </button>
                  {open === h.key && (
                    <div className="border-t px-3.5 pb-3.5 pt-3" style={{ borderColor: C.line }}>
                      {h.fields.map(([k, v]) => (
                        <div key={k} className="flex gap-3 py-[3px] text-[12.5px]">
                          <div className="w-[108px] shrink-0 text-muted-foreground">{k}</div>
                          <div className="min-w-0 flex-1 break-words" style={{ color: C.ink }}>{v || "-"}</div>
                        </div>
                      ))}
                      {h.screen && (
                        <button onClick={() => go(h.screen!)}
                          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-bold text-white"
                          style={{ background: C.ink }}>
                          เปิดหน้าที่เกี่ยวข้อง <ArrowUpRight size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {cam && (
        <CameraScan
          onClose={() => setCam(false)}
          onResult={(text) => {
            setCam(false);
            burst.current.reset();
            prevLen.current = text.length;
            setThaiWarn(false);
            setScanned("");
            setRaw(text);
          }}
        />
      )}
    </div>
  );
}
