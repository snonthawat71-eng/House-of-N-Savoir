import { useEffect, useState, useCallback } from "react";
import { Loader2, Lock, Eye, FileText, Download } from "lucide-react";
import { supabase } from "./lib/supabase";

const C = {
  bg: "#F1F2F4", card: "#FFFFFF", ink: "#111214",
  sub: "#8A8F98", red: "#E5322A", redSoft: "#FDECEA",
  green: "#16A45C", greenSoft: "#E7F5EE",
};
const SHADOW_SM = "0 1px 2px rgba(17,18,20,.05), 0 4px 12px rgba(17,18,20,.05)";

type Row = {
  id: number; actor_email: string | null; action: string;
  entity: string | null; entity_id: string | null; created_at: string;
};

const ROLE_TH: Record<string, string> = { owner: "เจ้าของ", dev: "Dev Support", manager: "ผู้จัดการ", sales: "ฝ่ายขาย/แอดมิน" };
const ACTION_TH: Record<string, string> = {
  create: "สร้าง", update: "แก้ไข", delete: "ลบ", invite: "เชิญผู้ใช้", view: "เข้าดู", login: "เข้าระบบ",
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("th-TH", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function tagOf(action: string): "secret" | "create" | "edit" | "view" {
  if (action === "delete") return "secret";
  if (action === "create" || action === "invite") return "create";
  if (action === "view" || action === "login") return "view";
  return "edit";
}

export default function AuditScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_log")
      .select("id, actor_email, action, entity, entity_id, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) setErr("โหลดไม่ได้: " + error.message);
    setRows((data as Row[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function exportCsv() {
    const head = ["เวลา", "ใคร", "ทำอะไร", "กับข้อมูล", "รหัส"];
    const lines = rows.map((r) => [
      new Date(r.created_at).toLocaleString("th-TH"),
      r.actor_email || "",
      ACTION_TH[r.action] || r.action,
      r.entity || "",
      r.entity_id || "",
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    const csv = "﻿" + [head.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-log-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-5 pb-32">
      <div className="flex items-center justify-between mt-2 mb-3 px-1">
        <p style={{ color: C.sub, fontSize: 13 }}>บันทึกทุกการเข้าดู/แก้ไข · เก็บถาวร</p>
        <button onClick={exportCsv} disabled={rows.length === 0}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1"
          style={{ background: C.ink, color: "#fff", fontSize: 11, fontWeight: 600, opacity: rows.length === 0 ? 0.5 : 1 }}>
          <Download size={12} /> Export
        </button>
      </div>

      {err && <p style={{ color: C.red, fontSize: 12 }} className="mb-2">{err}</p>}

      {loading ? (
        <div className="flex justify-center py-10" style={{ color: C.sub }}><Loader2 size={22} className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p style={{ color: C.sub, fontSize: 13 }} className="text-center py-10">ยังไม่มีบันทึก</p>
      ) : (
        rows.map((r) => {
          const map = { secret: [C.redSoft, C.red], edit: [C.bg, C.ink], create: [C.greenSoft, C.green], view: [C.bg, C.sub] } as const;
          const tag = tagOf(r.action);
          const [bg, fg] = map[tag];
          const act = (ACTION_TH[r.action] || r.action) + (r.entity ? " · " + r.entity : "") + (r.entity_id ? " (" + r.entity_id + ")" : "");
          return (
            <div key={r.id} className="rounded-2xl p-3.5 mb-2 flex items-start gap-3" style={{ background: C.card, boxShadow: SHADOW_SM }}>
              <div className="rounded-xl flex items-center justify-center shrink-0" style={{ width: 34, height: 34, background: bg, color: fg }}>
                {tag === "secret" ? <Lock size={15} /> : tag === "view" ? <Eye size={15} /> : <FileText size={15} />}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ color: C.ink, fontSize: 13, fontWeight: 500 }}>{act}</div>
                <div style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>
                  {r.actor_email || "-"} · {fmtTime(r.created_at)}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
