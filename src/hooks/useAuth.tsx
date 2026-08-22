import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session, Factor } from "@supabase/supabase-js";
import { ADMIN_CONFIRM_EMAIL, getOrCreateDeviceId, readTrustedDevice, saveTrustedDevice, clearTrustedDevice } from "@/lib/adminGate";

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
  mfaChecked: boolean;
  adminGateRequired: boolean;
  adminGateChecked: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  verifyMfa: (code: string) => Promise<{ error: string | null }>;
  enrollTotpStart: () => Promise<{ data: TotpEnroll | null; error: string | null }>;
  enrollTotpVerify: (factorId: string, code: string) => Promise<{ error: string | null }>;
  unenrollTotp: (factorId: string) => Promise<{ error: string | null }>;
  listFactors: () => Promise<Factor[]>;
  sendAdminEmailOtp: () => Promise<{ error: string | null }>;
  verifyAdminEmailOtp: (code: string) => Promise<{ error: string | null }>;
  refreshAdminGate: () => Promise<void>;
  enrollAdminWebAuthn: (credentialId: string) => Promise<{ error: string | null }>;
  verifyAdminWebAuthn: (credentialId: string) => Promise<{ error: string | null }>;
  listAdminWebAuthn: () => Promise<string[]>;
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

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

const ENROLL_STORAGE_KEY = "zxmax_mfa_enroll";
const ADMIN_OTP_TRUST_KEY = "zxmax_admin_otp_trusted";
const ADMIN_OTP_TRUST_DAYS = 30;

function markAdminOtpTrusted() {
  try {
    localStorage.setItem(
      ADMIN_OTP_TRUST_KEY,
      JSON.stringify({ expiresAt: Date.now() + ADMIN_OTP_TRUST_DAYS * 24 * 60 * 60 * 1000 }),
    );
  } catch {}
}

function clearAdminOtpTrust() {
  try {
    localStorage.removeItem(ADMIN_OTP_TRUST_KEY);
  } catch {}
}

function isAdminOtpTrusted() {
  try {
    const raw = localStorage.getItem(ADMIN_OTP_TRUST_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { expiresAt?: number };
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
      clearAdminOtpTrust();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function randomDeviceToken() {
  try {
    return (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Math.random().toString(36).slice(2) + Date.now());
  } catch {
    return String(Math.random().toString(36).slice(2) + Date.now());
  }
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
  const [mfaChecked, setMfaChecked] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [adminGateRequired, setAdminGateRequired] = useState(false);
  const [adminGateChecked, setAdminGateChecked] = useState(false);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await withTimeout(
        Promise.resolve(supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle()) as Promise<any>,
        2500,
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
        Promise.resolve(supabase.from("bans").select("reason, created_at").eq("user_id", userId).eq("active", true).limit(1).maybeSingle()) as Promise<any>,
        2000,
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
        Promise.resolve(supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle()) as Promise<any>,
        2000,
        { data: null } as any
      );
      setIsAdmin(!!data);
      return !!data;
    } catch {
      setIsAdmin(false);
      return false;
    }
  };

  const evaluateAdminGate = useCallback(async (sess: Session | null, adminFlag: boolean) => {
    if (!sess || !adminFlag) {
      setAdminGateRequired(false);
      setAdminGateChecked(true);
      return;
    }
    // When the admin email was confirmed by Supabase Auth OTP on this device,
    // the local trust takes precedence (the server "admin-login" function is
    // no longer required for the email path).
    if (isAdminOtpTrusted()) {
      setAdminGateRequired(false);
      setAdminGateChecked(true);
      return;
    }
    try {
      const deviceId = getOrCreateDeviceId();
      const trusted = readTrustedDevice();
      const result = await withTimeout(
        supabase.functions.invoke("admin-login", {
          body: { action: "check", deviceId, deviceToken: trusted?.deviceToken || "" },
        }),
        4000,
        { data: null, error: new Error("admin-login timeout") } as any,
      );
      const error = result?.error;
      const data = result?.data;
      if (error) {
        // Edge Function unreachable/not deployed. Fall back to locally-trusted
        // device (set by e-mail confirm, passkey or authenticator TOTP unlock).
        setAdminGateRequired(!trusted);
        setAdminGateChecked(true);
        return;
      }
      const ok = !!data?.trusted;
      // Only clear local trust when the server explicitly answered trusted:false
      // (token revoked). On timeout/no-response we keep the local trust.
      if (!ok && trusted && data && data.trusted === false) clearTrustedDevice();
      setAdminGateRequired(!ok);
    } catch {
      setAdminGateRequired(!readTrustedDevice());
    } finally {
      setAdminGateChecked(true);
    }
  }, []);

  const evaluateMfa = useCallback(async (sess: Session | null) => {
    if (!sess) {
      setMfaEnabled(false);
      setNeedsMfa(false);
      setChallengeId(null);
      setMfaChecked(true);
      return;
    }
    try {
      // TOTP remains optional. Admin access is gated by email/device (adminGateRequired).
      const { data } = await withTimeout(
        supabase.auth.mfa.listFactors(),
        2000,
        { data: { totp: [] }, error: null } as any
      );
      const verifiedTotp = (data?.totp || []).filter((f) => f.status === "verified");
      setMfaEnabled(verifiedTotp.length > 0);
      setNeedsMfa(false);
    } catch {
      setMfaEnabled(false);
      setNeedsMfa(false);
    } finally {
      setMfaChecked(true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let initTimeout: number | null = null;

    initTimeout = window.setTimeout(() => {
      if (mounted) {
        setLoading(false);
        setMfaChecked(true);
      }
    }, 3000);

    const init = async () => {
      try {
        const { data: { session: sess } } = await withTimeout(
          supabase.auth.getSession(),
          2500,
          { data: { session: null } } as any
        );
        if (!mounted) return;
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          const admin = await checkAdmin(sess.user.id).catch(() => false);
          await Promise.all([
            fetchProfile(sess.user.id).catch(() => null),
            checkBan(sess.user.id).catch(() => null),
            evaluateMfa(sess).catch(() => null),
            evaluateAdminGate(sess, !!admin).catch(() => null),
          ]);
        } else {
          setMfaChecked(true);
          setAdminGateChecked(true);
          setAdminGateRequired(false);
        }
      } catch (e) {
        console.error("Auth init error", e);
        setMfaChecked(true);
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
      setMfaChecked(false);

      if (sess?.user) {
        setLoading(true);
        try {
          const admin = await checkAdmin(sess.user.id).catch(() => false);
          await Promise.all([
            fetchProfile(sess.user.id).catch(() => null),
            checkBan(sess.user.id).catch(() => null),
            evaluateMfa(sess).catch(() => null),
            evaluateAdminGate(sess, !!admin).catch(() => null),
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
        setMfaChecked(true);
        setAdminGateRequired(false);
        setAdminGateChecked(true);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      if (initTimeout) clearTimeout(initTimeout);
      subscription.unsubscribe();
    };
  }, [evaluateMfa, evaluateAdminGate]);

  const signUp = async (email: string, password: string, displayName: string) => {
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
    setMfaChecked(false);
    setAdminGateChecked(false);
    if (data.session) {
      const admin = await checkAdmin(data.session.user.id);
      void evaluateMfa(data.session);
      void evaluateAdminGate(data.session, admin);
    }
    return { error: null };
  };

  const verifyMfa = async (code: string) => {
    const doVerify = async (cid: string, fid: string) => {
      const { data, error } = await supabase.auth.mfa.verify({
        factorId: fid,
        challengeId: cid,
        code,
      });
      if (error) return { error: error.message };
      if ((data as any)?.session) {
        setSession((data as any).session);
        setUser((data as any).session.user);
      }
      setNeedsMfa(false);
      setChallengeId(null);
      setMfaEnabled(true);
      // Mark MFA as verified for this session (admin only, 12h)
      try {
        sessionStorage.setItem("zxmax_admin_mfa_verified", String(Date.now()));
      } catch {}
      return { error: null };
    };

    if (!challengeId) {
      const factors = await listFactors();
      const verified = factors.find((f) => f.status === "verified");
      if (!verified) return { error: "Nenhum desafio pendente. Faça login novamente." };
      const chal = await supabase.auth.mfa.challenge({ factorId: verified.id });
      if (chal.error || !chal.data?.id) return { error: "Falha ao criar desafio 2FA." };
      setChallengeId(chal.data.id);
      return await doVerify(chal.data.id, verified.id);
    }
    const factor = (await listFactors()).find((f) => f.status === "verified");
    if (!factor) return { error: "Fator 2FA não encontrado." };
    return await doVerify(challengeId, factor.id);
  };

  const enrollTotpStart = async (): Promise<{ data: TotpEnroll | null; error: string | null }> => {
    try {
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const unverified = (existing?.totp || []).filter((f) => f.status !== "verified");
      for (const f of unverified) {
        try {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        } catch {}
      }
    } catch {}

    const uniqueName = `ZXMAX Authenticator ${Date.now().toString().slice(-4)}`;
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp" as any,
      friendlyName: uniqueName,
      issuer: "ZXMAX",
    } as any);
    if (error || !data) {
      if (error?.message?.includes("already exists")) {
        try {
          const { data: existing2 } = await supabase.auth.mfa.listFactors();
          for (const f of existing2?.totp || []) {
            if (f.status !== "verified") {
              await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
            }
          }
          const retry = await supabase.auth.mfa.enroll({
            factorType: "totp" as any,
            friendlyName: `ZXMAX ${Math.random().toString(36).slice(2, 6)}`,
            issuer: "ZXMAX",
          } as any);
          if (retry.error || !retry.data) return { data: null, error: retry.error?.message || "Falha ao iniciar 2FA" };
          return {
            data: { id: retry.data.id, qr: retry.data.totp.qr_code, secret: retry.data.totp.secret },
            error: null,
          };
        } catch {}
      }
      return { data: null, error: error?.message || "Falha ao iniciar 2FA" };
    }
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
    setMfaChecked(true);
    if ((verify.data as any)?.session) {
      setSession((verify.data as any).session);
      setUser((verify.data as any).session.user);
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

  const sendAdminEmailOtp = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email: ADMIN_CONFIRM_EMAIL,
      options: { shouldCreateUser: false },
    });
    if (error) return { error: error.message || "Não foi possível enviar o código de acesso." };
    return { error: null };
  };

  const verifyAdminEmailOtp = async (code: string) => {
    const normalized = String(code || "").replace(/\D/g, "").slice(0, 6);
    if (normalized.length !== 6) return { error: "Digite o código de 6 dígitos." };

    // Set the local trust before verifying so the auth-state listener that fires
    // right after verifyOtp sees this device as confirmed as soon as it succeeds.
    markAdminOtpTrusted();

    const { data, error } = await supabase.auth.verifyOtp({
      email: ADMIN_CONFIRM_EMAIL,
      token: normalized,
      type: "email",
    });

    if (error) {
      clearAdminOtpTrust();
      return { error: error.message || "Código inválido ou expirado." };
    }

    const nextSession = data?.session || null;
    if (nextSession) {
      setSession(nextSession);
      setUser(nextSession.user);
      setMfaChecked(false);
      setAdminGateChecked(false);
      const admin = await checkAdmin(nextSession.user.id).catch(() => false);
      const deviceToken = randomDeviceToken();
      const expiresAt = new Date(Date.now() + ADMIN_OTP_TRUST_DAYS * 24 * 60 * 60 * 1000).toISOString();
      saveTrustedDevice(deviceToken, expiresAt);
      void evaluateMfa(nextSession);
      void evaluateAdminGate(nextSession, admin);
    }
    return { error: null };
  };

  const refreshAdminGate = async () => {
    await evaluateAdminGate(session, isAdmin);
  };

  const enrollAdminWebAuthn = async (credentialId: string) => {
    const { data, error } = await supabase.functions.invoke("admin-login", {
      body: { action: "enroll_webauthn", deviceId: getOrCreateDeviceId(), credentialId },
    });
    if (error || data?.error) return { error: data?.error || error?.message || "Falha ao cadastrar." };
    if (data?.deviceToken) saveTrustedDevice(data.deviceToken, data.expiresAt);
    setAdminGateRequired(false);
    setAdminGateChecked(true);
    return { error: null };
  };

  const verifyAdminWebAuthn = async (credentialId: string) => {
    const { data, error } = await supabase.functions.invoke("admin-login", {
      body: { action: "verify_webauthn", deviceId: getOrCreateDeviceId(), credentialId },
    });
    if (error || data?.error) return { error: data?.error || error?.message || "Falha na confirmação." };
    if (data?.deviceToken) saveTrustedDevice(data.deviceToken, data.expiresAt);
    setAdminGateRequired(false);
    setAdminGateChecked(true);
    return { error: null };
  };

  const listAdminWebAuthn = async (): Promise<string[]> => {
    const { data } = await supabase.functions.invoke("admin-login", { body: { action: "webauthn_status" } });
    return ((data?.credentials || []) as { credential_id: string }[]).map((c) => c.credential_id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setBanned(null);
    setIsAdmin(false);
    setMfaEnabled(false);
    setNeedsMfa(false);
    setMfaChecked(true);
    setAdminGateRequired(false);
    setAdminGateChecked(true);
    setChallengeId(null);
    try {
      sessionStorage.removeItem("zxmax_admin_mfa_verified");
      localStorage.removeItem(ENROLL_STORAGE_KEY);
    } catch {}
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
      mfaEnabled, needsMfa, mfaChecked,
      adminGateRequired, adminGateChecked,
      signUp, signIn, verifyMfa,
      enrollTotpStart, enrollTotpVerify, unenrollTotp, listFactors,
      sendAdminEmailOtp, verifyAdminEmailOtp, refreshAdminGate, enrollAdminWebAuthn, verifyAdminWebAuthn, listAdminWebAuthn,
      signOut, refreshProfile, updateProfile: updateProfileFn,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
