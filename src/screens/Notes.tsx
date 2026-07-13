import { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { Plus, Loader2, Check, ChevronDown, ChevronUp, PartyPopper, X, CalendarDays } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { useBackHandler } from "../lib/nav";
import { C, inputStyle } from "../lib/ui";
import { toast } from "../lib/toast";
import { Field } from "./B2B";
import { Modal, DeleteButton } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

/* ---------------- types + helpers ---------------- */
export type Todo = {
  id: string; title: string; detail: string | null;
  due_date: string; due_time: string | null;
  assigned_to: string | null; created_by: string;
  done: boolean; done_at: string | null; created_at: string;
};
type Member = { id: string; full_name: string | null; email: string };

const todayStr = () => new Date().toISOString().slice(0, 10);
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");
const memberName = (m?: Member) => m ? (m.full_name || m.email.split("@")[0]) : "";
const AVA_COLORS = ["#014BAA", "#7A5AF8", "#16A45C", "#B45309", "#0E7490", "#BE185D"];
const avaColor = (id: string) => AVA_COLORS[(id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % AVA_COLORS.length];

/* เรียงงาน: วันก่อน → เวลา (ไม่มีเวลาไปท้ายของวัน) */
function byDue(a: Todo, b: Todo) {
  if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  const ta = a.due_time || "99:99", tb = b.due_time || "99:99";
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}

async function fetchTodos(): Promise<Todo[]> {
  const { data } = await supabase.from("todos")
    .select("id,title,detail,due_date,due_time,assigned_to,created_by,done,done_at,created_at")
    .order("due_date").order("due_time", { nullsFirst: false });
  return (data as Todo[]) || [];
}

/* ---------------- การ์ดเตือนบนหน้า Overview ----------------
   พับเป็นค่าเริ่มต้น: [เวลา · ชื่องาน · ปุ่ม ✓ · ลูกศรกาง]
   กด ✓ = เสร็จ แล้วเด้งงานถัดไปขึ้นมาแทนทันที · กดตัวการ์ด = เข้าหน้า Note */
export function TodoCard({ onOpen }: { onOpen: () => void }) {
  const auth = useAuth();
  const me = auth.profile?.id;
  const [items, setItems] = useState<Todo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(() => localStorage.getItem("ns_todo_open") === "1");

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !me) return;
    const all = await fetchTodos();
    // งานของฉัน (ถูกมอบให้ฉัน หรือฉันสร้างแบบไม่ระบุคน) ที่ยังไม่เสร็จ ถึงกำหนดวันนี้/เลยกำหนด
    const mine = all.filter((t) => !t.done && t.due_date <= todayStr() &&
      (t.assigned_to === me || (!t.assigned_to && t.created_by === me)));
    setItems(mine.sort(byDue));
    setLoaded(true);
  }, [me]);
  useEffect(() => { load(); }, [load]);

  const toggle = () => setOpen((o) => { localStorage.setItem("ns_todo_open", o ? "0" : "1"); return !o; });

  async function checkDone(t: Todo) {
    const { error } = await supabase.from("todos")
      .update({ done: true, done_at: new Date().toISOString() }).eq("id", t.id);
    if (error) { toast.error("บันทึกไม่สำเร็จ"); return; }
    await logAudit({ action: "update", entity: "todo", entityId: t.title, newValue: { done: true } });
    toast.success("เสร็จแล้ว 1 งาน");
    setItems((s) => s.filter((x) => x.id !== t.id));
  }

  if (!isSupabaseConfigured || !me || !loaded) return null;

  const now = items[0];
  const next = items[1];
  const overdue = now && now.due_date < todayStr();

  /* ไม่มีงานค้าง — แถวเดียวบอกว่าวันนี้เรียบร้อย */
  if (!now) {
    return (
      <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-left shadow-sm">
        <PartyPopper size={18} className="text-primary" />
        <span className="flex-1 text-[13px] font-semibold text-foreground">วันนี้ไม่มีงานค้างแล้ว</span>
        <span className="text-[11px] text-muted-foreground">เปิด Note ›</span>
      </button>
    );
  }

  const timeLabel = now.due_time ? hhmm(now.due_time) : "วันนี้";

  return (
    <div className="w-full rounded-2xl bg-card shadow-sm">
      {/* แถวหลัก (สถานะพับ) — ปุ่ม check วงกลมโปร่ง อยู่หน้าเวลา */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => checkDone(now)} aria-label="ทำเสร็จแล้ว"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
          style={{ borderColor: overdue ? C.red : C.brand, background: "transparent" }}>
          <Check size={17} strokeWidth={2.5} style={{ color: overdue ? C.red : C.brand }} />
        </button>
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <span className="shrink-0 font-disp text-[15px] font-extrabold tabular-nums"
            style={{ color: overdue ? C.red : C.brand }}>
            {overdue ? "เลยกำหนด" : timeLabel}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-foreground">{now.title}</span>
        </button>
        <button onClick={toggle} aria-label={open ? "พับ" : "กาง"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* ส่วนกาง: งานถัดไป + จำนวนที่เหลือ */}
      {open && (
        <button onClick={onOpen} className="w-full border-t border-dashed border-border px-4 py-2.5 text-left">
          {next ? (
            <div className="flex items-center gap-2.5">
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 font-disp text-[10px] font-extrabold text-muted-foreground">ถัดไป</span>
              <span className="shrink-0 font-disp text-[12px] font-extrabold tabular-nums text-foreground">
                {next.due_time ? hhmm(next.due_time) : "วันนี้"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-muted-foreground">{next.title}</span>
              {items.length > 2 && <span className="shrink-0 text-[10.5px] text-muted-foreground">+{items.length - 2}</span>}
            </div>
          ) : (
            <span className="text-[12px] text-muted-foreground">ไม่มีงานถัดไปแล้ว · แตะเพื่อเปิด Note</span>
          )}
        </button>
      )}
    </div>
  );
}

/* ---------------- หน้าหลัก Note — รวมรายการทั้งหมด ---------------- */
type ModalState = { k: "form"; item: Todo | null } | null;

export default function NotesScreen() {
  const auth = useAuth();
  const me = auth.profile?.id;
  const [rows, setRows] = useState<Todo[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);

  const load = useCallback(async () => {
    const [ts, ms] = await Promise.all([
      fetchTodos(),
      supabase.from("profiles").select("id, full_name, email").eq("active", true),
    ]);
    setRows(ts);
    setMembers((ms.data as Member[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); logAudit({ action: "view", entity: "screen", entityId: "notes" }); }, [load]);
  useBackHandler(modal !== null, () => setModal(null));

  const memberOf = (id?: string | null) => members.find((m) => m.id === id);

  async function toggleDone(t: Todo) {
    const done = !t.done;
    const { error } = await supabase.from("todos")
      .update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", t.id);
    if (error) { toast.error("บันทึกไม่สำเร็จ"); return; }
    await logAudit({ action: "update", entity: "todo", entityId: t.title, newValue: { done } });
    if (done) toast.success("เสร็จแล้ว 1 งาน");
    setRows((s) => s.map((x) => (x.id === t.id ? { ...x, done } : x)));
  }
  async function del(t: Todo) {
    if (!confirm("ลบงานนี้?")) return;
    const { error } = await supabase.from("todos").delete().eq("id", t.id);
    if (error) { toast.error("ลบไม่สำเร็จ"); return; }
    await logAudit({ action: "delete", entity: "todo", entityId: t.title, oldValue: t });
    toast.success("ลบงานแล้ว");
    setModal(null); load();
  }

  /* จัดกลุ่ม: เลยกำหนด / วันนี้ / วันถัดไป (ตามวันที่) / เสร็จแล้ว */
  const today = todayStr();
  const pending = rows.filter((r) => !r.done).sort(byDue);
  const doneRows = rows.filter((r) => r.done).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || "")).slice(0, 30);
  const overdue = pending.filter((r) => r.due_date < today);
  const todayRows = pending.filter((r) => r.due_date === today);
  const future = pending.filter((r) => r.due_date > today);
  const futureDates = [...new Set(future.map((r) => r.due_date))];

  const dateLabel = (d: string) => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const th = new Date(d + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
    return d === tomorrow ? `พรุ่งนี้ · ${th}` : th;
  };

  const GroupLabel = ({ children }: { children: ReactNode }) => (
    <div className="mb-2 mt-5 flex items-center gap-2.5 px-1">
      <span className="font-disp text-[12px] font-extrabold text-muted-foreground">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );

  const Row = ({ t, highlight }: { t: Todo; highlight?: boolean }) => {
    const who = memberOf(t.assigned_to);
    const byOther = t.created_by !== me && t.assigned_to === me;
    const creator = memberOf(t.created_by);
    const late = !t.done && t.due_date < today;
    return (
      <div className="mb-2.5 rounded-2xl bg-card p-4 shadow-sm"
        style={highlight ? { border: `1.5px solid ${C.brand}` } : undefined}>
        {/* แถวบน: วันที่ซ้าย · คนเกี่ยวข้องขวา */}
        <div className="mb-2.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <CalendarDays size={12} className="shrink-0" />
          <span style={late ? { color: C.red, fontWeight: 700 } : undefined}>
            {new Date(t.due_date + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}
          </span>
          {late && (
            <span className="rounded-full px-2 py-0.5 font-disp text-[9px] font-extrabold"
              style={{ background: C.redSoft, color: C.red }}>เลยกำหนด</span>
          )}
          <span className="flex-1" />
          {byOther && creator && (
            <span className="rounded-full px-2 py-0.5 font-disp text-[9px] font-extrabold"
              style={{ background: "#FEF3C7", color: "#B45309" }}>{memberName(creator)}มอบให้</span>
          )}
          {who && (
            <span className="inline-flex items-center gap-1">
              <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full font-disp text-[8.5px] font-extrabold text-white"
                style={{ background: avaColor(who.id) }}>{memberName(who).slice(0, 1).toUpperCase()}</span>
              {t.assigned_to === me ? "ของฉัน" : memberName(who)}
            </span>
          )}
        </div>
        {/* แถวล่าง: ปุ่ม check (หน้าเวลา) · เวลา · ชื่องาน */}
        <div className="flex items-center gap-3">
          <button onClick={() => toggleDone(t)} aria-label="ติ๊กเสร็จ"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
            style={t.done ? { background: C.brand, borderColor: C.brand } : { borderColor: "#C9CDD3", background: "transparent" }}>
            {t.done && <Check size={16} strokeWidth={3} className="text-white" />}
          </button>
          <span className="shrink-0 font-disp text-[14px] font-extrabold tabular-nums"
            style={{ color: t.done ? C.sub : late ? C.red : C.brand }}>
            {hhmm(t.due_time) || "--:--"}
          </span>
          <button onClick={() => setModal({ k: "form", item: t })} className="min-w-0 flex-1 text-left">
            <div className={"text-[13.5px] font-bold " + (t.done ? "text-muted-foreground line-through" : "text-foreground")}>{t.title}</div>
            {t.detail && <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{t.detail}</div>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="px-5 pb-32">
      <p className="mb-1 mt-2 px-1 text-xs text-muted-foreground">
        {loading ? "กำลังโหลด…" : `วันนี้เสร็จแล้ว ${rows.filter((r) => r.done && r.due_date === today).length} จาก ${rows.filter((r) => r.due_date === today).length} งาน`}
      </p>

      <button onClick={() => setModal({ k: "form", item: null })}
        className="mb-2 mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white"
        style={{ background: C.brand }}>
        <Plus size={16} /> เพิ่มงาน / โน้ต
      </button>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">ยังไม่มีงาน — กด "เพิ่มงาน / โน้ต" เพื่อสร้างรายการแรก</p>
      ) : (
        <>
          {overdue.length > 0 && (<><GroupLabel>เลยกำหนด</GroupLabel>{overdue.map((t) => <Row key={t.id} t={t} />)}</>)}
          <GroupLabel>วันนี้ · {new Date().toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}</GroupLabel>
          {todayRows.length === 0
            ? <p className="px-1 py-2 text-[12.5px] text-muted-foreground">ไม่มีงานวันนี้</p>
            : todayRows.map((t, i) => <Row key={t.id} t={t} highlight={i === 0 && overdue.length === 0} />)}
          {futureDates.map((d) => (
            <div key={d}>
              <GroupLabel>{dateLabel(d)}</GroupLabel>
              {future.filter((r) => r.due_date === d).map((t) => <Row key={t.id} t={t} />)}
            </div>
          ))}
          {doneRows.length > 0 && (<><GroupLabel>เสร็จแล้ว</GroupLabel>{doneRows.map((t) => <Row key={t.id} t={t} />)}</>)}
        </>
      )}

      <Modal open={modal?.k === "form"} onClose={() => setModal(null)}
        title={modal?.k === "form" && modal.item ? "แก้ไขงาน" : "เพิ่มงาน / โน้ต"}>
        {modal?.k === "form" && (
          <TodoForm initial={modal.item} members={members} me={me}
            onDone={() => { setModal(null); load(); }}
            onDelete={modal.item ? () => del(modal.item!) : undefined} />
        )}
      </Modal>
    </div>
  );
}

/* ฟอร์มเพิ่ม/แก้ไขงาน — ตั้งวัน เวลา และมอบหมายให้เพื่อนในทีม */
function TodoForm({ initial, members, me, onDone, onDelete }: {
  initial: Todo | null; members: Member[]; me?: string;
  onDone: () => void; onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [detail, setDetail] = useState(initial?.detail || "");
  const [date, setDate] = useState(initial?.due_date || todayStr());
  const [time, setTime] = useState(hhmm(initial?.due_time));
  // ค่าว่าง = งานของตัวเอง (ไม่ต้องเลือกตัวเองใน dropdown)
  const [assignee, setAssignee] = useState(initial?.assigned_to && initial.assigned_to !== me ? initial.assigned_to : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!title.trim()) { setErr("ต้องมีชื่องาน"); return; }
    if (!date || !time) { setErr("ต้องกำหนดวันและเวลา"); return; }
    setBusy(true);
    const payload = {
      title: title.trim(), detail: detail.trim() || null,
      due_date: date, due_time: time,
      assigned_to: assignee || me || null,
    };
    const { error } = initial
      ? await supabase.from("todos").update(payload).eq("id", initial.id)
      : await supabase.from("todos").insert(payload);
    if (error) { setErr(error.message); toast.error("บันทึกไม่สำเร็จ"); setBusy(false); return; }
    await logAudit({ action: initial ? "update" : "create", entity: "todo", entityId: title.trim(), newValue: payload });
    toast.success(initial ? "แก้ไขงานแล้ว" : "เพิ่มงานแล้ว");
    onDone();
  }

  const ClearBtn = ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick} aria-label="ล้าง" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-muted-foreground"><X size={13} /></button>
  );

  return (
    <div className="pb-4">
      <Field label="ชื่องาน"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น เช็คสต็อก Central Chidlom" className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <Field label="รายละเอียด (ไม่บังคับ)"><input value={detail} onChange={(e) => setDetail(e.target.value)} className="w-full rounded-2xl px-4 py-3" style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
        <Field label="กำหนดวัน">
          <div className="relative min-w-0">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="box-border w-full min-w-0 appearance-none rounded-2xl px-3 py-3 pr-8 text-[13px]" style={inputStyle} />
            {date && <ClearBtn onClick={() => setDate("")} />}
          </div>
        </Field>
        <Field label="เวลา">
          <div className="relative min-w-0">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="box-border w-full min-w-0 appearance-none rounded-2xl px-3 py-3 pr-8 text-[13px]" style={inputStyle} />
            {time && <ClearBtn onClick={() => setTime("")} />}
          </div>
        </Field>
      </div>
      <Field label="มอบหมายให้ (ไม่เลือก = งานของฉัน)">
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full rounded-2xl px-4 py-3 text-sm" style={inputStyle}>
          <option value="">งานของฉัน</option>
          {members.filter((m) => m.id !== me).map((m) => (
            <option key={m.id} value={m.id}>{memberName(m)}</option>
          ))}
        </select>
      </Field>
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button onClick={save} disabled={busy} className="w-full rounded-2xl py-6 text-[15px]">{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
      {onDelete && <DeleteButton onClick={onDelete} label="ลบงานนี้" />}
    </div>
  );
}
