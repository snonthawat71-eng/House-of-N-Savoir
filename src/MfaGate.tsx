import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, LogOut } from "lucide-react";
import { supabase } from "./lib/supabase";
import { useAuth } from "./lib/auth";

const C = {
  bg: "#F1F2F4", card: "#FFFFFF", ink: "#111214",
  sub: "#8A8F98", line: "#EAECEF", brand: "#014BAA", brandSoft: "#E7EEF7", red: "#E5322A",
};
const disp = "'Urbanist', 'Noto Sans Thai', system-ui, sans-serif";
const sans = "'Urbanist', 'Noto Sans Thai', system-ui, sans-serif";

/**
 * หน้าจอยืนยันตัวตนขั้นที่ 2 (2FA/OTP ด้วยแอป Authenticator)
 * - ครั้งแรก: สแกน QR ด้วย Google Authenticator แล้วใส่รหัส 6 หลักเพื่อผูกเครื่อง
 * - ครั้งต่อไป: ใส่รหัส 6 หลักจากแอปทุกครั้งที่เข้า
 */
export default function MfaGate() {
  const auth = useAuth();
  const [mode, setMode] = useState<"loading" | "enroll" | "challenge">("loading");
  const [factorId, setFactorId] = useState<string>("");
  const [qr, setQr] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  // ตอนเปิดหน้า: ดูว่ามีการผูกเครื่องแล้วหรือยัง
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const verified = (data?.totp || []).find((f: any) => f.status === "verified");
        if (!alive) return;
        if (verified) {
          setFactorId(verified.id);
          setMode("challenge");
        } else {
          await startEnroll(data?.totp || []);
        }
      } catch (e: any) {
        if (alive) setErr(readableError(e));
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // เริ่มผูกเครื่องใหม่ (ล้างตัวที่ค้างยังไม่ยืนยันออกก่อน)
  async function startEnroll(existing: any[]) {
    try {
      for (const f of existing) {
        if (f.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "N Savoir " + Date.now(),
      });
      if (error) throw error;
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setMode("enroll");
    } catch (e: any) {
      setErr(readableError(e));
    }
  }

  async function submit() {
    setErr("");
    if (code.trim().length < 6) { setErr("ใส่รหัส 6 หลักให้ครบ"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim(),
      });
      if (error) throw error;
      await auth.refreshAAL(); // ผ่านแล้ว → แอปจะพาเข้าหน้าหลักเอง
    } catch (e: any) {
      setErr(readableError(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: sans, background: C.bg, minHeight: "100vh", color: C.ink }}
      className="flex flex-col items-center justify-center px-7 max-w-md mx-auto">
      <div className="w-full text-center">
        <div className="mx-auto mb-4 flex items-center justify-center rounded-2xl"
          style={{ width: 64, height: 64, background: C.ink, color: "#fff" }}>
          <ShieldCheck size={30} style={{ color: C.brand }} />
        </div>
        <div style={{ fontFamily: disp, fontSize: 20, fontWeight: 800 }}>ยืนยันตัวตนขั้นที่ 2</div>

        {mode === "loading" && (
          <div className="mt-8 flex justify-center" style={{ color: C.sub }}>
            <Loader2 size={22} className="animate-spin" />
          </div>
        )}

        {mode === "enroll" && (
          <div className="mt-5">
            <p style={{ color: C.sub, fontSize: 13 }} className="leading-relaxed">
              ครั้งแรกครั้งเดียว: เปิดแอป <b>Google Authenticator</b> (หรือ Authy)<br />
              กด + แล้ว <b>สแกน QR</b> ข้างล่างนี้
            </p>
            <div className="mx-auto mt-4 rounded-2xl p-3 inline-block" style={{ background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,.06)" }}>
              {qr.trim().startsWith("<svg")
                ? <div style={{ width: 180, height: 180 }} dangerouslySetInnerHTML={{ __html: qr }} />
                : <img src={qr} width={180} height={180} alt="QR" />}
            </div>
            <p style={{ color: C.sub, fontSize: 11 }} className="mt-3">
              สแกนไม่ได้? พิมพ์รหัสนี้ในแอปแทน:<br />
              <span style={{ fontFamily: "monospace", color: C.ink, fontSize: 12, wordBreak: "break-all" }}>{secret}</span>
            </p>
          </div>
        )}

        {mode === "challenge" && (
          <p style={{ color: C.sub, fontSize: 13 }} className="mt-5 leading-relaxed">
            เปิดแอป <b>Authenticator</b> แล้วใส่รหัส 6 หลักของ <b>HOUSE OF N SAVOIR</b>
          </p>
        )}

        {(mode === "enroll" || mode === "challenge") && (
          <div className="mt-5">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="123456"
              className="w-full rounded-2xl py-4 text-center"
              style={{ background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.05)", fontFamily: disp, fontSize: 24, letterSpacing: 6, color: C.ink, border: "none", outline: "none" }}
            />
            {err && <p style={{ color: C.red, fontSize: 12 }} className="mt-2">{err}</p>}
            <button onClick={submit} disabled={busy}
              className="mt-4 w-full rounded-2xl py-4 flex items-center justify-center gap-2"
              style={{ background: C.brand, color: "#fff", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : "ยืนยัน"}
            </button>
          </div>
        )}

        {mode === "loading" && err && (
          <p style={{ color: C.red, fontSize: 12 }} className="mt-4">{err}</p>
        )}

        <button onClick={() => auth.signOut()}
          className="mt-6 inline-flex items-center gap-2" style={{ color: C.sub, fontSize: 13 }}>
          <LogOut size={14} /> ออกจากระบบ
        </button>
      </div>
    </div>
  );
}

function readableError(e: any): string {
  const m = (e?.message || String(e) || "").toLowerCase();
  if (m.includes("invalid") || m.includes("code")) return "รหัสไม่ถูกต้อง ลองใหม่อีกครั้ง";
  if (m.includes("expired")) return "รหัสหมดอายุ ใส่รหัสใหม่จากแอป";
  return e?.message || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
}
