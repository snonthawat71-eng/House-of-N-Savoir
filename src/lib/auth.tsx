import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";

// โปรไฟล์ผู้ใช้ที่ดึงจากฐานข้อมูล (บอกว่าเป็นใคร role อะไร)
export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: "owner" | "dev" | "manager" | "sales" | string;
  active: boolean;
};

type AAL = { current: string | null; next: string | null };

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** true = ล็อกอินสำเร็จแต่ไม่ได้รับเชิญ (ไม่มีโปรไฟล์) */
  notInvited: boolean;
  /** ระดับการยืนยันตัวตน: aal1 = ล็อกอินแล้ว, aal2 = ผ่าน 2 ชั้นแล้ว */
  aal: AAL;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshAAL: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notInvited, setNotInvited] = useState(false);
  const [aal, setAal] = useState<AAL>({ current: null, next: null });

  const refreshAAL = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setAal({ current: data?.currentLevel ?? null, next: data?.nextLevel ?? null });
  }, []);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setNotInvited(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, active")
      .eq("id", s.user.id)
      .maybeSingle();
    if (error) {
      // อ่านโปรไฟล์ไม่ได้ (เช่น RLS ปิดกั้น) → ถือว่ายังไม่มีสิทธิ์
      setProfile(null);
      setNotInvited(true);
      return;
    }
    if (!data || data.active === false) {
      setProfile(null);
      setNotInvited(true);
    } else {
      setProfile(data as Profile);
      setNotInvited(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session);
      await refreshAAL();
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (!mounted) return;
      setSession(s);
      await loadProfile(s);
      await refreshAAL();
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, refreshAAL]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setNotInvited(false);
    setAal({ current: null, next: null });
  }, []);

  const refreshProfile = useCallback(() => loadProfile(session), [loadProfile, session]);

  return (
    <Ctx.Provider
      value={{ loading, session, profile, notInvited, aal, signInWithGoogle, signOut, refreshProfile, refreshAAL }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
