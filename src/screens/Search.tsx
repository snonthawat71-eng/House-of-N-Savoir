/**
 * ช่องค้นหาทั้งระบบ — ฝังอยู่ในหน้าแรกเลย กดแล้วพิมพ์หรือยิงสแกนได้ทันที
 * ผลลัพธ์ขึ้นใต้ช่องค้นหา กดแล้วพาไปหน้านั้นเลย
 * ค้นข้ามทุกหมวดที่ผู้ใช้คนนั้นมีสิทธิ์เห็น (หมวดที่ไม่มีสิทธิ์จะไม่ถูกค้นเลย)
 * สูตรกลิ่น (Formula Lab) ไม่ถูกค้นในนี้ เพราะเป็นข้อมูลลับเฉพาะเจ้าของ
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search as SearchIcon, ScanLine, X, Loader2, Languages, ChevronRight } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, mono, fmtDate, baht } from "../lib/ui";
import { hasThai, thaiToEn, makeBurstDetector } from "../lib/thaikey";
import { CameraScan } from "../lib/scan";

type Row = Record<string, unknown>;
type Hit = {
  key: string; group: string; title: string; sub: string; detail: string;
  screen: string; table: string; id: string;
};

const s = (v: unknown) => (v == null || v === "" ? "" : String(v));
const join = (...a: string[]) => a.filter(Boolean).join(" · ");

/** รายการที่จะเอาไปค้น — ชื่อตาราง, ช่องที่ค้น, สิทธิ์ที่ต้องมี, หน้าที่จะพาไป */
type Src = {
  key: string; table: string; group: string; cols: string; search: string[];
  need?: string[];                       // ต้องมีสิทธิ์หมวดใดหมวดหนึ่งในนี้
  title: (r: Row) => string;
  sub: (r: Row) => string;
  detail: (r: Row) => string;
  screen: (r: Row) => string;
};

const SOURCES: Src[] = [
  {
    key: "product", table: "products_view", group: "สินค้า",
    cols: "id,sku,name,type,size,retail,stock", search: ["sku", "name", "type", "size"],
    title: (r) => s(r.name) || s(r.sku),
    sub: (r) => join(s(r.sku), s(r.size)),
    detail: (r) => join(s(r.type), `ราคา ${baht(r.retail as number)}`, `คงเหลือ ${s(r.stock) || "0"}`),
    screen: () => "products",
  },
  {
    key: "brand", table: "brands", group: "แบรนด์",
    cols: "id,name,created_at", search: ["name"],
    title: (r) => s(r.name), sub: () => "แบรนด์สินค้า",
    detail: (r) => `เพิ่มเมื่อ ${fmtDate(s(r.created_at))}`,
    screen: () => "products",
  },
  {
    key: "customer", table: "customers", group: "ลูกค้า",
    cols: "id,name,kind,contact,credit_terms,note", search: ["name", "contact", "note"],
    need: ["b2b", "b2c", "office"],
    title: (r) => s(r.name),
    sub: (r) => join(s(r.kind).toUpperCase(), s(r.contact)),
    detail: (r) => join(s(r.credit_terms) && `เครดิต ${s(r.credit_terms)}`, s(r.note)),
    screen: (r) => (s(r.kind) === "b2c" ? "b2c" : "b2b"),
  },
  {
    key: "order", table: "orders", group: "ออเดอร์",
    cols: "id,customer_name,kind,status,total,note,created_at", search: ["customer_name", "status", "note"],
    need: ["b2b", "b2c", "office"],
    title: (r) => s(r.customer_name) || "ออเดอร์",
    sub: (r) => join(s(r.kind).toUpperCase(), s(r.status)),
    detail: (r) => join(baht(r.total as number), fmtDate(s(r.created_at))),
    screen: (r) => (s(r.kind) === "b2c" ? "b2c" : "b2b"),
  },
  {
    key: "quote", table: "quotations", group: "ใบเสนอราคา",
    cols: "id,number,customer_name,total,status,created_at", search: ["number", "customer_name", "status"],
    need: ["b2b", "office"],
    title: (r) => s(r.number) || "ใบเสนอราคา",
    sub: (r) => join(s(r.customer_name), s(r.status)),
    detail: (r) => join(baht(r.total as number), fmtDate(s(r.created_at))),
    screen: () => "b2b",
  },
  {
    key: "sample", table: "samples", group: "ตัวอย่างที่ส่ง",
    cols: "id,customer_name,item,sent_date,tracking,status", search: ["customer_name", "item", "tracking", "status"],
    need: ["b2b", "office"],
    title: (r) => s(r.item) || "ตัวอย่าง",
    sub: (r) => join(s(r.customer_name), s(r.tracking)),
    detail: (r) => join(s(r.status), `ส่ง ${fmtDate(s(r.sent_date))}`),
    screen: () => "b2b",
  },
  {
    key: "supplier", table: "suppliers", group: "ผู้ผลิต/ซัพพลายเออร์",
    cols: "id,name,material,contact,contract_end,note", search: ["name", "material", "contact", "note"],
    need: ["supplier", "office"],
    title: (r) => s(r.name),
    sub: (r) => join(s(r.material), s(r.contact)),
    detail: (r) => (r.contract_end ? `สัญญาหมดอายุ ${fmtDate(s(r.contract_end))}` : s(r.note)),
    screen: () => "supplier",
  },
  {
    key: "po", table: "purchase_orders", group: "ใบสั่งซื้อ (PO)",
    cols: "id,number,supplier_name,total,status,created_at", search: ["number", "supplier_name", "status"],
    need: ["supplier", "office"],
    title: (r) => s(r.number) || "PO",
    sub: (r) => join(s(r.supplier_name), s(r.status)),
    detail: (r) => join(baht(r.total as number), fmtDate(s(r.created_at))),
    screen: () => "supplier",
  },
  {
    key: "batch", table: "batch_labels", group: "Batch Label",
    cols: "id,title,code,batch_no,mfg_date,exp_date,quantity,customer_name",
    search: ["batch_no", "code", "title", "customer_name"],
    need: ["office"],
    title: (r) => s(r.title) || s(r.batch_no),
    sub: (r) => join(`BATCH ${s(r.batch_no)}`, s(r.code)),
    detail: (r) => join(s(r.customer_name), s(r.quantity), `หมดอายุ ${fmtDate(s(r.exp_date))}`),
    screen: () => "print",
  },
  {
    key: "fo", table: "fo_labels", group: "FO Label",
    cols: "id,code,name,batch_of,mfg_date,bbe_date,net,customer_name",
    search: ["batch_of", "code", "name", "customer_name"],
    need: ["office"],
    title: (r) => s(r.name) || s(r.code),
    sub: (r) => join(s(r.code), `BATCH ${s(r.batch_of)}`),
    detail: (r) => join(s(r.customer_name), s(r.net) && `Net ${s(r.net)}`, `BBE ${fmtDate(s(r.bbe_date))}`),
    screen: () => "print",
  },
  {
    key: "shop", table: "stock_locations", group: "ร้าน/คลัง",
    cols: "id,name,kind,shop_name,branch_name,branch_code,phone",
    search: ["name", "shop_name", "branch_name", "branch_code", "phone"],
    need: ["b2c", "office"],
    title: (r) => s(r.shop_name) || s(r.name),
    sub: (r) => join(s(r.branch_name), s(r.kind)),
    detail: (r) => join(s(r.branch_code) && `รหัสสาขา ${s(r.branch_code)}`, s(r.phone)),
    screen: () => "b2c",
  },
  {
    key: "campaign", table: "campaigns", group: "การตลาด",
    cols: "id,name,channel,status,note", search: ["name", "channel", "status", "note"],
    need: ["b2c", "office"],
    title: (r) => s(r.name),
    sub: (r) => join(s(r.channel), s(r.status)),
    detail: (r) => s(r.note),
    screen: () => "b2c",
  },
];
/** ตัดตัวอักษรที่ทำให้คำสั่งค้นหาของฐานข้อมูลพัง */
const safe = (q: string) => q.replace(/[,()%*\\"']/g, " ").replace(/\s+/g, " ").trim();

export function GlobalSearch({ mods, go, onActive }: {
  mods: string[];
  go: (screen: string) => void;
  /** บอกหน้าแรกว่ากำลังค้นอยู่ไหม จะได้ซ่อนการ์ดหมวดงานชั่วคราว */
  onActive?: (active: boolean) => void;
}) {
  const [raw, setRaw] = useState("");
  const [scanned, setScanned] = useState("");      // ข้อความที่แปลงจากคีย์บอร์ดไทยแล้ว
  const [thaiWarn, setThaiWarn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [cam, setCam] = useState(false);
  const burst = useRef(makeBurstDetector());
  const prevLen = useRef(0);
  const box = useRef<HTMLInputElement>(null);

  useBackHandler(cam, () => setCam(false));

  /** ข้อความที่ใช้ค้นจริง */
  const term = scanned || raw;

  const onChange = (v: string) => {
    const isBurst = burst.current.feed(v.length, prevLen.current);
    prevLen.current = v.length;
    setRaw(v);
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
    setRaw(""); setScanned(""); setThaiWarn(false); setHits([]);
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
          title: src.title(row) || "(ไม่มีชื่อ)", sub: src.sub(row), detail: src.detail(row),
          screen: src.screen(row),
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

  /** กำลังค้นอยู่ไหม — หน้าแรกจะได้ซ่อนการ์ดหมวดงานชั่วคราว */
  const active = term.trim().length >= 2;
  useEffect(() => { onActive?.(active); }, [active, onActive]);

  const groups = useMemo(() => {
    const g = new Map<string, Hit[]>();
    hits.forEach((h) => { const a = g.get(h.group) || []; a.push(h); g.set(h.group, a); });
    return [...g.entries()];
  }, [hits]);

  /** กดผลลัพธ์ = บันทึกลง Audit Log แล้วพาไปหน้านั้นเลย */
  const openHit = (h: Hit) => {
    void logAudit({ action: "view", entity: h.table, entityId: h.id, newValue: { from: "ค้นหาทั้งระบบ" } });
    go(h.screen);
  };

  return (
    <>
      {/* ช่องค้นหา + ปุ่มสแกน */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm">
          <SearchIcon size={16} className="shrink-0 text-muted-foreground" />
          <input
            ref={box}
            value={raw}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); void run(term.trim()); } }}
            placeholder="ค้นหาทั้งระบบ หรือยิงโค้ดตรงนี้…"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            style={{ color: C.ink, boxShadow: "none", border: "none" }}
          />
          {raw && (
            <button onClick={clear} aria-label="ล้าง" className="shrink-0 text-muted-foreground">
              <X size={16} />
            </button>
          )}
        </div>
        <button onClick={() => setCam(true)} aria-label="สแกนโค้ดด้วยกล้อง"
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

      {/* ผลลัพธ์ — ขึ้นใต้ช่องค้นหาเลย */}
      {active && (
        <div className="mt-3">
          {!isSupabaseConfigured ? (
            <p className="py-6 text-center text-[12.5px] text-muted-foreground">โหมดเดโม — ยังไม่ได้ต่อฐานข้อมูล</p>
          ) : busy && !hits.length ? (
            <div className="flex justify-center py-6 text-muted-foreground"><Loader2 size={20} className="animate-spin" /></div>
          ) : !hits.length ? (
            <p className="py-6 text-center text-[12.5px] text-muted-foreground">
              ไม่พบ “<b style={{ color: C.ink }}>{term.trim()}</b>” ในระบบ
            </p>
          ) : (
            groups.map(([g, list]) => (
              <div key={g} className="mb-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="font-disp text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">{g}</div>
                  <div className="text-[11px] text-muted-foreground">{list.length}</div>
                </div>
                {list.map((h) => (
                  <button key={h.key} onClick={() => openHit(h)}
                    className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-card p-3.5 text-left shadow-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-bold" style={{ color: C.ink }}>{h.title}</div>
                      {h.sub && <div className="truncate text-[11.5px] text-muted-foreground" style={{ fontFamily: mono }}>{h.sub}</div>}
                      {h.detail && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{h.detail}</div>}
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}

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
    </>
  );
}
