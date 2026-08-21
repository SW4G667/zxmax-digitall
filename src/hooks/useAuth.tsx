import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session, Factor, AdminFactorType } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  public_id?: number;
  email: string;
  display_name: string;
  avatar_url: string;
  pix_key: string;
  is_verified_seller: boolean;
  document_type: string;
  full_name?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  verification_selfie_path?: string | null;
  verification_status?: string | null;
  verification_notes?: string | null;
  verification_submitted_at?: string | null;
}

interface BanInfo {
  reason: string;
  created_at: string;
}

export interface TotpEnroll {
  id: string;
  qr: string;
  secret: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  banned: BanInfo | null;
  isAdmin: boolean;
  mfaEnabled: boolean;
  needsMfa: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  verifyMfa: (code: string) => Promise<{ error: string | null }>;
  enrollTotpStart: () => Promise<{ data: TotpEnroll | null; error: string | null }>;
  enrollTotpVerify: (factorId: string, code: string) => Promise<{ error: string | null }>;
  unenrollTotp: (factorId: string) => Promise<{ error: string | null }>;
  listFactors: () => Promise<Factor[]>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<Pick<Profile, "display_name" | "avatar_url" | "pix_key" | "document_type">>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

// Helper: timeout wrapper
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [banned, setBanned] = useState<BanInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await withTimeout(
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        5000,
        { data: null, error: null } as any
      );
      if (data) setProfile(data as Profile);
      return data as Profile | null;
    } catch {
      return null;
    }
  };

  const checkBan = async (userId: string) => {
    try {
      const { data } = await withTimeout(
        supabase.from("bans").select("reason, created_at").eq("user_id", userId).eq("active", true).limit(1).maybeSingle(),
        4000,
        { data: null } as any
      );
      if (data) {
        setBanned(data as BanInfo);
        return true;
      }
      setBanned(null);
      return false;
    } catch {
      setBanned(null);
      return false;
    }
  };

  const checkAdmin = async (userId: string) => {
    try {
      const { data } = await withTimeout(
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
        4000,
        { data: null } as any
      );
      setIsAdmin(!!data);
    } catch {
      setIsAdmin(false);
    }
  };

  const evaluateMfa = useCallback(async (sess: Session | null) => {
    if (!sess) {
      setMfaEnabled(false);
      setNeedsMfa(false);
      setChallengeId(null);
      return;
    }
    try {
      const { data, error } = await withTimeout(
        supabase.auth.mfa.listFactors(),
        5000,
        { data: { totp: [] }, error: null } as any
      );
      if (error) throw error;
      const verifiedTotp = (data?.totp || []).filter((f) => f.status === "verified");
      setMfaEnabled(verifiedTotp.length > 0);
      const aal: string = (sess as any)?.aal || sess.user?.aal || sess.user?.app_metadata?.aal || "aal1";
      if (verifiedTotp.length > 0 && aal !== "aal2" && verifiedTotp[0]) {
        if (!challengeId) {
          const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
            factorId: verifiedTotp[0].id,
          });
          if (!chalErr && chal?.id) setChallengeId(chal.id);
        }
        setNeedsMfa(true);
      } else {
        setNeedsMfa(false);
      }
    } catch {
      setMfaEnabled(false);
      setNeedsMfa(false);
    }
  }, [challengeId]);

  useEffect(() => {
    let mounted = true;
    let initTimeout: number | null = null;

    // Safety: force loading false after 10s no matter what
    initTimeout = window.setTimeout(() => {
      if (mounted) setLoading(false);
    }, 10000);

    const init = async () => {
      try {
        const { data: { session: sess } } = await withTimeout(
          supabase.auth.getSession(),
          6000,
          { data: { session: null } } as any
        );
        if (!mounted) return;
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          await Promise.all([
            fetchProfile(sess.user.id).catch(() => null),
            checkBan(sess.user.id).catch(() => null),
            checkAdmin(sess.user.id).catch(() => null),
            evaluateMfa(sess).catch(() => null),
          ]);
        }
      } catch (e) {
        console.error("Auth init error", e);
      } finally {
        if (mounted) {
          setLoading(false);
          if (initTimeout) clearTimeout(initTimeout);
        }
      }
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      if (!mounted) return;
      setSession(sess);
      setUser(sess?.user ?? null);

      if (sess?.user) {
        setLoading(true);
        try {
          await Promise.all([
            fetchProfile(sess.user.id).catch(() => null),
            checkBan(sess.user.id).catch(() => null),
            checkAdmin(sess.user.id).catch(() => null),
            evaluateMfa(sess).catch(() => null),
          ]);
        } finally {
          if (mounted) setLoading(false);
        }
      } else {
        setProfile(null);
        setBanned(null);
        setIsAdmin(false);
        setMfaEnabled(false);
        setNeedsMfa(false);
        setChallengeId(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      if (initTimeout) clearTimeout(initTimeout);
      subscription.unsubscribe();
    };
  }, [evaluateMfa]);

  const signUp = async (email: string, password: string, displayName: string) => {
    // Basic rate limit check client side
    const last = localStorage.getItem("zxmax_last_signup");
    if (last && Date.now() - Number(last) < 5000) {
      return { error: "Aguarde 5s antes de tentar novamente." };
    }
    localStorage.setItem("zxmax_last_signup", String(Date.now()));
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const key = `zxmax_login_attempts_${email}`;
    const raw = localStorage.getItem(key);
    const attempts = raw ? JSON.parse(raw) : { count: 0, last: 0 };
    if (attempts.count >= 5 && Date.now() - attempts.last < 15 * 60 * 1000) {
      return { error: "Muitas tentativas. Tente novamente em 15 minutos." };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const next = { count: attempts.count + 1, last: Date.now() };
      localStorage.setItem(key, JSON.stringify(next));
      return { error: error.message };
    }
    localStorage.removeItem(key);
    if (data.session) void evaluateMfa(data.session);
    return { error: null };
  };

  const verifyMfa = async (code: string) => {
    if (!challengeId) return { error: "Nenhum desafio pendente." };
    const factor = (await listFactors()).find((f) => f.status === "verified");
    if (!factor) return { error: "Fator 2FA não encontrado." };
    const { data, error } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId,
      code,
    });
    if (error) return { error: error.message };
    if (data?.session) {
      setSession(data.session);
      setUser(data.session.user);
    }
    setNeedsMfa(false);
    setChallengeId(null);
    setMfaEnabled(true);
    return { error: null };
  };

  const enrollTotpStart = async (): Promise<{ data: TotpEnroll | null; error: string | null }> => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp" as AdminFactorType,
      friendlyName: "ZXMAX Authenticator",
      issuer: "ZXMAX",
    } as any);
    if (error || !data) return { data: null, error: error?.message || "Falha ao iniciar 2FA" };
    return {
      data: { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret },
      error: null,
    };
  };

  const enrollTotpVerify = async (factorId: string, code: string) => {
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) return { error: challenge.error.message };
    const verify = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data!.id, code });
    if (verify.error) return { error: verify.error.message };
    setMfaEnabled(true);
    setNeedsMfa(false);
    if (verify.data?.session) {
      setSession(verify.data.session);
      setUser(verify.data.session.user);
    }
    return { error: null };
  };

  const unenrollTotp = async (factorId: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) return { error: error.message };
    setMfaEnabled(false);
    setNeedsMfa(false);
    return { error: null };
  };

  const listFactors = async (): Promise<Factor[]> => {
    const { data } = await supabase.auth.mfa.listFactors();
    return data?.totp || [];
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setBanned(null);
    setIsAdmin(false);
    setMfaEnabled(false);
    setNeedsMfa(false);
    setChallengeId(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const updateProfileFn = async (data: Partial<Pick<Profile, "display_name" | "avatar_url" | "pix_key" | "document_type">>) => {
    if (!user) return;
    await supabase.from("profiles").update(data).eq("user_id", user.id);
    await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{
      user, profile, session, loading, banned, isAdmin,
      mfaEnabled, needsMfa,
      signUp, signIn, verifyMfa,
      enrollTotpStart, enrollTotpVerify, unenrollTotp, listFactors,
      signOut, refreshProfile, updateProfile: updateProfileFn,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
