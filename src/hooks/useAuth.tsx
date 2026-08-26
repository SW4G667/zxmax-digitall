import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session, Factor } from "@supabase/supabase-js";
import { clearAdminGate, peekStoredSession, readAdminGate, wipePersistedAuth, withTimeout, writeAdminGate } from "@/lib/authSession";

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
  /** Indica que o RPC de papel respondeu para o usuário autenticado atual. */
  adminRoleResolved: boolean;
  mfaEnabled: boolean;
  /** True when this browser already confirmed the authenticator code for the
   * current admin. Persisted in localStorage: the code is only asked again
   * after signing out and clicking Admin once more. */
  adminGateUnlocked: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Verifies the 6-digit authenticator code (challenge + verify). A success
   * also elevates the session to AAL2, which is required to manage factors. */
  verifyMfa: (code: string) => Promise<{ error: string | null }>;
  enrollTotpStart: () => Promise<{ data: TotpEnroll | null; error: string | null }>;
  enrollTotpVerify: (factorId: string, code: string) => Promise<{ error: string | null }>;
  unenrollTotp: (factorId: string) => Promise<{ error: string | null }>;
  listFactors: () => Promise<Factor[]>;
  /** Returns true when managing MFA factors (new QR / disable) requires typing
   * the current authenticator code first (verified factor + session not AAL2). */
  needsCodeToManageMfa: () => Promise<boolean>;
  /** Marks the admin gate as unlocked in this browser (after a valid code). */
  unlockAdminGate: () => void;
  /** Locks the admin panel in this browser without signing the user out. */
  lockAdminGate: () => void;
  /** Re-reads the admin gate flag from storage (kept for the gate component). */
  refreshAdminGate: () => void;
  signOut: (scope?: "local" | "global" | "others") => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<Pick<Profile, "display_name" | "avatar_url" | "pix_key" | "document_type">>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

function friendlyMfaError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid totp") || m.includes("invalid code") || m.includes("incorrect")) {
    return "Código incorreto. Verifique o horário do celular e tente novamente.";
  }
  if (m.includes("expired")) return "Código expirado. Use o código mais recente do aplicativo.";
  if (m.includes("aal2")) return "Confirme o código atual do autenticador antes de continuar.";
  return message || "Erro na verificação.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // A sessão pode iniciar do armazenamento do SDK, mas nunca aceitamos um
  // papel administrativo vindo do navegador. O papel é confirmado no banco.
  const [bootSession] = useState<Session | null>(() => peekStoredSession());
  const [user, setUser] = useState<User | null>(() => bootSession?.user ?? null);
  const [session, setSession] = useState<Session | null>(bootSession);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(() => !bootSession);
  const [banned, setBanned] = useState<BanInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRoleResolved, setAdminRoleResolved] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [adminGateUnlocked, setAdminGateUnlocked] = useState(() => (bootSession?.user ? readAdminGate(bootSession.user.id) : false));

  const userRef = useRef<User | null>(bootSession?.user ?? null);
  const lastRecoveryAttempt = useRef(0);
  const ignoreSignedOutRecoveryRef = useRef(false);

  const applySession = useCallback((sess: Session | null) => {
    const u = sess?.user ?? null;
    userRef.current = u;
    setSession(sess);
    setUser(u);
    if (u) {
      // Nunca mostrar privilégios até a confirmação do banco; cache local não
      // é uma fonte de autorização.
      setIsAdmin(false);
      setAdminRoleResolved(false);
      setAdminGateUnlocked(readAdminGate(u.id));
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const res = await withTimeout(
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        8000,
        null as any
      );
      if (res?.data && userRef.current?.id === userId) setProfile(res.data as Profile);
      return (res?.data as Profile | null) ?? null;
    } catch {
      return null;
    }
  }, []);

  const checkBan = useCallback(async (userId: string) => {
    try {
      const res = await withTimeout(
        supabase.from("bans").select("reason, created_at").eq("user_id", userId).eq("active", true).limit(1).maybeSingle(),
        8000,
        null as any
      );
      if (!res || res.error || userRef.current?.id !== userId) return false;
      if (res.data) {
        setBanned(res.data as BanInfo);
        return true;
      }
      setBanned(null);
      return false;
    } catch {
      return false;
    }
  }, []);

  const checkAdmin = useCallback(async (userId: string) => {
    try {
      const res = await withTimeout(
        (supabase as any).rpc("has_role", { _user_id: userId, _role: "admin" }),
        8000,
        null as any
      );
      // Em timeout/erro, falha fechada: o painel não fica acessível até haver
      // confirmação. As operações administrativas também validam o papel no
      // servidor, independentemente desta indicação visual.
      if (!res || res.error) {
        if (userRef.current?.id === userId) {
          setIsAdmin(false);
          setAdminRoleResolved(true);
        }
        return;
      }
      const admin = res.data === true;
      if (userRef.current?.id === userId) {
        setIsAdmin(admin);
        setAdminRoleResolved(true);
      }
    } catch {
      if (userRef.current?.id === userId) {
        setIsAdmin(false);
        setAdminRoleResolved(true);
      }
    }
  }, []);

  const refreshMfaFlag = useCallback(async () => {
    try {
      const { data } = await withTimeout(supabase.auth.mfa.listFactors(), 8000, { data: null, error: null } as any);
      const verified = (data?.totp || []).some((f: any) => f.status === "verified");
      setMfaEnabled(verified);
    } catch { /* noop */ }
  }, []);

  /** Loads profile/ban/admin/2FA in the background for the given user.
   * Never toggles `loading` — the UI already renders from the stored session. */
  const hydrateAccount = useCallback(
    (userId: string) => {
      void Promise.all([
        fetchProfile(userId).catch(() => null),
        checkBan(userId).catch(() => null),
        checkAdmin(userId).catch(() => null),
        refreshMfaFlag().catch(() => null),
      ]);
    },
    [fetchProfile, checkBan, checkAdmin, refreshMfaFlag]
  );

  useEffect(() => {
    let mounted = true;

    // Watchdog: if something unexpected stalls init without a stored session,
    // still release the UI instead of trapping it on "Carregando...".
    const watchdog = window.setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    const init = async () => {
      try {
        let sess: Session | null = null;
        try {
          const { data } = await supabase.auth.getSession();
          sess = data.session;
        } catch { /* noop */ }
        // If Supabase dropped the session (e.g. a token refresh that failed
        // while the tab was in the background), try to recover it silently
        // once before falling back to the login screen.
        if (!sess && !ignoreSignedOutRecoveryRef.current) {
          try {
            const { data } = await supabase.auth.refreshSession();
            sess = data.session;
          } catch { /* noop */ }
        }
        if (!mounted) return;
        if (ignoreSignedOutRecoveryRef.current) {
          setLoading(false);
          return;
        }
        applySession(sess);
        if (sess?.user) {
          setLoading(false);
          hydrateAccount(sess.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setBanned(null);
          setIsAdmin(false);
          setAdminRoleResolved(false);
          setMfaEnabled(false);
          setAdminGateUnlocked(false);
          setLoading(false);
        }
      } catch (e) {
        console.error("Auth init error", e);
        if (mounted) setLoading(false);
      }
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      if (!mounted) return;
      const nextUser = sess?.user ?? null;
      const prevId = userRef.current?.id ?? null;

      if (ignoreSignedOutRecoveryRef.current && nextUser) return;

      if (!nextUser) {
        // Intentional logout already wiped the UI — do not try to recover and
        // keep the flag armed until a fresh signIn disarms it (a SIGNED_OUT
        // event from the SDK must not let a later TOKEN_REFRESHED restore).
        if (ignoreSignedOutRecoveryRef.current) {
          userRef.current = null;
          setSession(null);
          setUser(null);
          setProfile(null);
          setBanned(null);
          setIsAdmin(false);
          setAdminRoleResolved(false);
          setMfaEnabled(false);
          setAdminGateUnlocked(false);
          setLoading(false);
          return;
        }
        // A SIGNED_OUT can be spurious (background token refresh failed and
        // Supabase removed the session). Try ONE silent recovery before
        // showing the login screen.
        const now = Date.now();
        if (prevId && now - lastRecoveryAttempt.current > 30_000) {
          lastRecoveryAttempt.current = now;
          try {
            const { data } = await supabase.auth.refreshSession();
            if (data.session?.user && mounted) {
              applySession(data.session);
              return;
            }
          } catch { /* noop */ }
        }
        userRef.current = null;
        setSession(null);
        setUser(null);
        setProfile(null);
        setBanned(null);
        setIsAdmin(false);
        setAdminRoleResolved(false);
        setMfaEnabled(false);
        setAdminGateUnlocked(false);
        setLoading(false);
        return;
      }

      if (nextUser.id === prevId) {
        // Same user (token refreshed / tab refocused): only swap the tokens.
        // No data reload, no loading flash, admin state untouched.
        setSession(sess);
        setUser(nextUser);
        setLoading(false);
        return;
      }

      // Different user (or fresh login): apply and hydrate once in background.
      setLoading(false);
      applySession(sess);
      hydrateAccount(nextUser.id);
    });

    return () => {
      mounted = false;
      window.clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, [applySession, hydrateAccount]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
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
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const key = `zxmax_login_attempts_${email}`;
    const raw = localStorage.getItem(key);
    const attempts = raw ? JSON.parse(raw) : { count: 0, last: 0 };
    if (attempts.count >= 5 && Date.now() - attempts.last < 15 * 60 * 1000) {
      return { error: "Muitas tentativas. Tente novamente em 15 minutos." };
    }
    ignoreSignedOutRecoveryRef.current = false;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const next = { count: attempts.count + 1, last: Date.now() };
      localStorage.setItem(key, JSON.stringify(next));
      return { error: error.message };
    }
    localStorage.removeItem(key);
    return { error: null };
  }, []);

  const listFactors = useCallback(async (): Promise<Factor[]> => {
    const { data } = await supabase.auth.mfa.listFactors();
    return data?.totp || [];
  }, []);

  /** challenge + verify on the verified factor. On success the SDK persists
   * the new AAL2 session and notifies listeners; we re-sync state from it. */
  const verifyMfa = useCallback(
    async (code: string) => {
      try {
        const factors = await listFactors();
        const verified = factors.find((f) => f.status === "verified");
        if (!verified) return { error: "Nenhum autenticador configurado nesta conta." };
        const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: verified.id });
        if (chalErr || !chal?.id) return { error: "Falha ao criar o desafio de verificação." };
        const { error } = await supabase.auth.mfa.verify({ factorId: verified.id, challengeId: chal.id, code });
        if (error) return { error: friendlyMfaError(error.message) };
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) applySession(sessionData.session);
        setMfaEnabled(true);
        return { error: null };
      } catch (e: any) {
        return { error: e?.message || "Falha na verificação." };
      }
    },
    [listFactors, applySession]
  );

  const needsCodeToManageMfa = useCallback(async (): Promise<boolean> => {
    try {
      const factors = await listFactors();
      if (!factors.some((f) => f.status === "verified")) return false;
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      return data?.currentLevel !== "aal2";
    } catch {
      // Could not check: if a verified factor exists, ask for the code — the
      // alternative is the Supabase "AAL2 required" error the user kept hitting.
      return true;
    }
  }, [listFactors]);

  const unlockAdminGate = useCallback(() => {
    const u = userRef.current;
    if (!u) return;
    writeAdminGate(u.id);
    setAdminGateUnlocked(true);
  }, []);

  const lockAdminGate = useCallback(() => {
    const u = userRef.current;
    if (u) clearAdminGate(u.id);
    setAdminGateUnlocked(false);
  }, []);

  const refreshAdminGate = useCallback(() => {
    const u = userRef.current;
    setAdminGateUnlocked(u ? readAdminGate(u.id) : false);
  }, []);

  const enrollTotpStart = useCallback(async (): Promise<{ data: TotpEnroll | null; error: string | null }> => {
    // Clean up leftover UNVERIFIED factors first (client-side, works at AAL1).
    try {
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const unverified = (existing?.totp || []).filter((f) => f.status !== "verified");
      for (const f of unverified) {
        try {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        } catch { /* noop */ }
      }
    } catch { /* noop */ }

    const doEnroll = () =>
      supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `ZXMAX ${Date.now().toString().slice(-6)}`,
        issuer: "ZXMAX",
      });

    const { data, error } = await doEnroll();
    if (error || !data) {
      if (error?.message?.includes("already exists")) {
        try {
          const { data: existing2 } = await supabase.auth.mfa.listFactors();
          for (const f of existing2?.totp || []) {
            if (f.status !== "verified") {
              await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
            }
          }
          const retry = await doEnroll();
          if (retry.error || !retry.data) {
            return { data: null, error: friendlyMfaError(retry.error?.message || "Falha ao iniciar 2FA") };
          }
          return {
            data: { id: retry.data.id, qr: retry.data.totp.qr_code, secret: retry.data.totp.secret },
            error: null,
          };
        } catch { /* noop */ }
      }
      return { data: null, error: friendlyMfaError(error?.message || "Falha ao iniciar 2FA") };
    }
    return {
      data: { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret },
      error: null,
    };
  }, []);

  const enrollTotpVerify = useCallback(
    async (factorId: string, code: string) => {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error || !challenge.data?.id) return { error: "Falha ao criar o desafio de verificação." };
      const verify = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
      if (verify.error) return { error: friendlyMfaError(verify.error.message) };
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) applySession(sessionData.session);
      setMfaEnabled(true);
      return { error: null };
    },
    [applySession]
  );

  const unenrollTotp = useCallback(async (factorId: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) return { error: friendlyMfaError(error.message) };
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      setMfaEnabled((data?.totp || []).some((f) => f.status === "verified"));
    } catch {
      setMfaEnabled(false);
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async (scope: "local" | "global" | "others" = "local") => {
    // Ending other sessions must not affect this device's UI or browser session.
    if (scope === "others") {
      try { await supabase.auth.signOut({ scope: "others" }); } catch { /* noop */ }
      return;
    }
    // Intentional logout: arm the recovery guard FIRST so no auth event
    // (TOKEN_REFRESHED, INITIAL_SESSION, a refreshSession, or onAuthStateChange)
    // can restore the session while we are logging out.
    ignoreSignedOutRecoveryRef.current = true;

    // Wipe React state immediately — the UI must read as logged out even if
    // the Supabase SDK lock stalls or the user reloads before it releases.
    userRef.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
    setBanned(null);
    setIsAdmin(false);
    setAdminRoleResolved(false);
    setMfaEnabled(false);
    setAdminGateUnlocked(false);
    setLoading(false);

    // Remove persisted credentials BEFORE awaiting the SDK. If the Supabase
    // storage lock hangs or the user reloads mid-call, there is no sb-*-auth*
    // token left in localStorage to silently restore the admin session.
    wipePersistedAuth();

    try {
      // Best-effort remote sign-out, bounded so a stuck lock can never block
      // the local logout for more than 2 seconds.
      await withTimeout(
        supabase.auth.signOut({ scope: scope === "global" ? "global" : "local" }),
        2000,
        null as any,
      );
    } catch { /* network/lock failure — local wipe already happened */ }

    // Wipe again: the SDK can recreate sb-*-auth* keys as it tears down its
    // internal storage during signOut, so a second pass guarantees they are gone.
    wipePersistedAuth();
  }, []);

  const refreshProfile = useCallback(async () => {
    const u = userRef.current;
    if (u) await fetchProfile(u.id);
  }, [fetchProfile]);

  const updateProfileFn = useCallback(
    async (data: Partial<Pick<Profile, "display_name" | "avatar_url" | "pix_key" | "document_type">>) => {
      const u = userRef.current;
      if (!u) return;
      await supabase.from("profiles").update(data).eq("user_id", u.id);
      await fetchProfile(u.id);
    },
    [fetchProfile]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        banned,
        isAdmin,
        adminRoleResolved,
        mfaEnabled,
        adminGateUnlocked,
        signUp,
        signIn,
        verifyMfa,
        enrollTotpStart,
        enrollTotpVerify,
        unenrollTotp,
        listFactors,
        needsCodeToManageMfa,
        unlockAdminGate,
        lockAdminGate,
        refreshAdminGate,
        signOut,
        refreshProfile,
        updateProfile: updateProfileFn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
