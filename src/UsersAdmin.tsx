import { useEffect, useState, useCallback } from "react";
import { UserPlus, Loader2, Check, ShieldAlert } from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { logAudit } from "./lib/audit";

const C = {
  bg: "#F1F2F4", card: "#FFFFFF", ink: "#111214",
  sub: "#8A8F98", line: "#EAECEF", red: "#E5322A", redSoft: "#FDECEA",
  green: "#16A45C", greenSoft: "#E7F5EE",
};
const SHADOW_SM = "0 1px 2px rgba(17,18,20,.05), 0 4px 12px rgba(17,18,20,.05)";
const disp = "'Plus Jakarta Sans', system-ui, sans-serif";
const sans = "'Inter', system-ui, sans-serif";

const ROLE_LABELS: Record<string, string> = {
  owner: "เจ้าของ",
  dev: "Dev Support",
  manager: "ผู้จัดการ",
  sales: "ฝ่ายขาย/แอดมิน",
};
const ROLE_OPTIONS = ["owner", "dev", "manager", "sales"];

type Invite = { email: string; role: string; full_name: string | null; active: boolean };
type Member = { id: string; email: string; role: string; active: boolean };

export default function UsersAdmin() {
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("sales");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    const [a, p] = await Promise.all([
      supabase.from("allowed_emails").select("email, role, full_name, active").order("created_at", { ascending: true }),
      supabase.from("profiles").select("id, email, role, active"),
    ]);
    setInvites((a.data as Invite[]) || []);
    setMembers((p.data as Member[]) || []);
    if (a.error) setErr("โหลดข้อมูลไม่ได้: " + a.error.message);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loggedIn = (e: string) => members.find((m) => m.email.toLowerCase() === e.toLowerCase());

  async function invite() {
    setErr(""); setMsg("");
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setErr("อีเมลไม่ถูกต้อง"); return; }
    setBusy(true);
    const { error } = await supabase.from("allowed_emails")
      .upsert({ email: e, role, full_name: name.trim() || null, active: true }, { onConflict: "email" });
    if (error) { setErr("เชิญไม่สำเร็จ: " + error.message); setBusy(false); return; }
    await logAudit({ action: "invite", entity: "allowed_emails", entityId: e, newValue: { role, active: true } });
    setEmail(""); setName(""); setRole("sales");
    setMsg("เชิญ " + e + " แล้ว");
    setBusy(false);
    load();
  }

  async function changeRole(inv: Invite, newRole: string) {
    setErr(""); setMsg("");
    const e = inv.email.toLowerCase();
    await supabase.from("allowed_emails").update({ role: newRole }).eq("email", e);
    await supabase.from("profiles").update({ role: newRole }).eq("email", e);
    await logAudit({ action: "update", entity: "role", entityId: e, oldValue: inv.role, newValue: newRole });
    load();
  }

  async function toggleActive(inv: Invite) {
    setErr(""); setMsg("");
    const e = inv.email.toLowerCase();
    const next = !inv.active;
    await supabase.from("allowed_emails").update({ active: next }).eq("email", e);
    await supabase.from("profiles").update({ active: next }).eq("email", e);
    await logAudit({ action: "update", entity: "active", entityId: e, oldValue: inv.active, newValue: next });
    load();
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="px-5 pb-32 pt-4">
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.redSoft, color: C.red }}>
          <ShieldAlert size={18} /> โหมดเดโม — หน้าจัดการผู้ใช้ใช้ได้เฉพาะระบบจริง (ต่อ Supabase แล้ว)
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-32" style={{ fontFamily: sans }}>
      {/* ฟอร์มเชิญ */}
      <div className="rounded-3xl p-4 mt-2" style={{ background: C.card, boxShadow: SHADOW_SM }}>
        <div className="flex items-center gap-2 mb-3" style={{ color: C.ink }}>
          <UserPlus size={17} style={{ color: C.red }} />
          <span style={{ fontFamily: disp, fontSize: 15, fontWeight: 700 }}>เชิญผู้ใช้ใหม่</span>
        </div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมล Google"
          inputMode="email"
          className="w-full rounded-2xl px-4 py-3 mb-2" style={{ background: C.bg, border: "none", outline: "none", fontSize: 14, color: C.ink }} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อเล่น (ไม่บังคับ)"
          className="w-full rounded-2xl px-4 py-3 mb-2" style={{ background: C.bg, border: "none", outline: "none", fontSize: 14, color: C.ink }} />
        <div className="flex gap-2">
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="flex-1 rounded-2xl px-4 py-3" style={{ background: C.bg, border: "none", outline: "none", fontSize: 14, color: C.ink }}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button onClick={invite} disabled={busy}
            className="rounded-2xl px-5 flex items-center justify-center gap-2"
            style={{ background: C.ink, color: "#fff", fontWeight: 700, fontSize: 14, opacity: busy ? 0.6 : 1 }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : "เชิญ"}
          </button>
        </div>
        {msg && <p style={{ color: C.green, fontSize: 12 }} className="mt-2 flex items-center gap-1"><Check size={13} /> {msg}</p>}
        {err && <p style={{ color: C.red, fontSize: 12 }} className="mt-2">{err}</p>}
      </div>

      {/* รายชื่อ */}
      <div className="px-1 mb-3 mt-6" style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, color: C.ink }}>
        รายชื่อผู้ใช้ ({invites.length})
      </div>

      {loading ? (
        <div className="flex justify-center py-8" style={{ color: C.sub }}><Loader2 size={22} className="animate-spin" /></div>
      ) : (
        invites.map((inv) => {
          const m = loggedIn(inv.email);
          return (
            <div key={inv.email} className="rounded-2xl p-4 mb-2" style={{ background: C.card, boxShadow: SHADOW_SM, opacity: inv.active ? 1 : 0.5 }}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div style={{ color: C.ink, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {inv.full_name || inv.email}
                  </div>
                  <div style={{ color: C.sub, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis" }}>{inv.email}</div>
                </div>
                <span className="rounded-full px-2 py-0.5 shrink-0" style={{
                  background: m ? C.greenSoft : C.bg, color: m ? C.green : C.sub, fontSize: 10, fontWeight: 600,
                }}>{m ? "เข้าระบบแล้ว" : "ยังไม่เข้า"}</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <select value={inv.role} onChange={(e) => changeRole(inv, e.target.value)}
                  className="flex-1 rounded-xl px-3 py-2" style={{ background: C.bg, border: "none", outline: "none", fontSize: 13, color: C.ink }}>
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                <button onClick={() => toggleActive(inv)}
                  className="rounded-xl px-3 py-2" style={{
                    background: inv.active ? C.redSoft : C.greenSoft, color: inv.active ? C.red : C.green,
                    fontSize: 13, fontWeight: 600,
                  }}>
                  {inv.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
