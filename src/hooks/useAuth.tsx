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
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) setProfile(data as Profile);
    return data as Profile | null;
  };

  const checkBan = async (userId: string) => {
    const { data } = await supabase
      .from("bans")
      .select("reason, created_at")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (data) {
      setBanned(data as BanInfo);
      return true;
    }
    setBanned(null);
    return false;
  };

  const checkAdmin = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
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
      const { data, error } = await supabase.auth.mfa.listFactors();
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

    // Fix: getSession FIRST, then onAuthStateChange to avoid race that caused "voltava pra conta do admin"
    const init = async () => {
      try {
        const { data: { session: sess } } = await supabase.auth.getSession();
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
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      if (!mounted) return;
      setSession(sess);
      setUser(sess?.user ?? null);

      if (sess?.user) {
        setLoading(true);
        await Promise.all([
          fetchProfile(sess.user.id).catch(() => null),
          checkBan(sess.user.id).catch(() => null),
          checkAdmin(sess.user.id).catch(() => null),
          evaluateMfa(sess).catch(() => null),
        ]);
        setLoading(false);
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
      subscription.unsubscribe();
    };
  }, [evaluateMfa]);

  const signUp = async (email: string, password: string, displayName: string) => {
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.session) void evaluateMfa(data.session);
    return { error: null };
  };

  const verifyMfa = async (code: string) => {
    if (!challengeId) return { error: "Nenhum desafio pendente." };
    const { data, error } = await supabase.auth.mfa.verify({
      factorId: (await listFactors()).find((f) => f.status === "verified")?.id || "",
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
