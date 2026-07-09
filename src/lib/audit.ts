import { supabase, isSupabaseConfigured } from "./supabase";

export type AuditEntry = {
  action: string; // view / create / update / delete / invite / login
  entity?: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
};

// บันทึกการกระทำลง Audit Log (ใคร ทำอะไร กับข้อมูลไหน ค่าเดิม→ค่าใหม่)
export async function logAudit(entry: AuditEntry) {
  if (!isSupabaseConfigured) return;
  try {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (!s) return;
    await supabase.from("audit_log").insert({
      actor_id: s.user.id,
      actor_email: s.user.email,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entityId ?? null,
      old_value: (entry.oldValue ?? null) as never,
      new_value: (entry.newValue ?? null) as never,
    });
  } catch {
    // อย่าให้การบันทึก log ทำให้งานหลักพัง
  }
}
