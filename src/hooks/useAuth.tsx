import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from "react";
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
  unlockAdminGate: () => void;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  verifyMfa: (code: string) => Promise<{ error: string | null }>;
  enrollTotpStart: () => Promise<{ data: TotpEnroll | null; error: string | null }>;
  enrollTotpVerify: (factorId: string, code: string) => Promise<{ error: string | null }>;
  unenrollTotp: (factorId?: string) => Promise<{ error: string | null }>;
  resetMfa: () => Promise<{ error: string | null }>;
  needsCodeToManageMfa: () => Promise<boolean>;
  elevateWithCode: (code: string) => Promise<{ error: string | null }>;
  listFactors: () => Promise<Factor[]>;
  refreshAdminGate: () => Promise<void>;
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
const ADMIN_UNLOCKED_KEY = "zxmax_admin_unlocked_uid";
const ADMIN_OTP_TRUST_KEY = "zxmax_admin_otp_trusted";
const ADMIN_OTP_PENDING_KEY = "zxmax_admin_otp_pending";
const ADMIN_OTP_TRUST_DAYS = 30;
// Network timeout used for the auxiliary queries (profile/ban/role/mfa).
// It used to be 2s, which on mobile/3G silently produced "logged out" and
// "not an admin" states. 10s + cache fallback is much safer.
const NET_TIMEOUT = 10_000;

const ADMIN_LAST_KEY = "zxmax_is_admin_last";

function isCachedAdmin(userId: string): boolean {
  try {
    return localStorage.getItem(`zxmax_is_admin_${userId}`) === "true";
  } catch {
    return false;
  }
}

// Read the last known admin flag *synchronously* at mount. Without this the
// admin button vanished on every tab focus/re-render until the async role
// query came back.
function isCachedAdminAny(): boolean {
  try {
    return localStorage.getItem(ADMIN_LAST_KEY) === "true";
  } catch {
    return false;
  }
}

function setCachedAdmin(userId: string, isAdmin: boolean) {
  try {
    if (isAdmin) {
      localStorage.setItem(`zxmax_is_admin_${userId}`, "true");
      localStorage.setItem(ADMIN_LAST_KEY, "true");
    } else {
      localStorage.removeItem(`zxmax_is_admin_${userId}`);
      localStorage.removeItem(ADMIN_LAST_KEY);
    }
  } catch {}
}

function isAdminSessionUnlocked(userId: string): boolean {
  try {
    const unlockedUid = localStorage.getItem(ADMIN_UNLOCKED_KEY);
    return unlockedUid === userId;
  } catch {
    return false;
  }
}

function setAdminSessionUnlocked(userId: string) {
  try {
    localStorage.setItem(ADMIN_UNLOCKED_KEY, userId);
    sessionStorage.setItem("zxmax_admin_mfa_verified", String(Date.now()));
  } catch {}
}

function clearAdminSessionUnlocked() {
  try {
    localStorage.removeItem(ADMIN_UNLOCKED_KEY);
    sessionStorage.removeItem("zxmax_admin_mfa_verified");
  } catch {}
}

function randomDeviceToken() {
  try {
    return (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Math.random().toString(36).slice(2) + Date.now());
  } catch {
    return String(Math.random().toString(36).slice(2) + Date.now());
  }
}

function friendlyMfaError(msg?: string | null): string {
  const m = (msg || "").toLowerCase();
  if (!m) return "Falha ao iniciar autenticador. Tente novamente.";
  if (m.includes("aal2") || m.includes("insufficient")) {
    return "Já existe um autenticador ativo nesta conta. Use a opção 'Perdi o acesso ao autenticador' para apagar o antigo e gerar um novo QR Code.";
  }
  if (m.includes("exceed") || m.includes("limit")) {
    return "Limite de autenticadores atingido. Use a opção 'Perdi o acesso ao autenticador' para limpar os antigos.";
  }
  if (m.includes("invalid") && m.includes("code")) {
    return "Código incorreto. Confira o horário automático do celular e tente o próximo código.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
  }
  return msg || "Falha ao iniciar autenticador.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [banned, setBanned] = useState<BanInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => isCachedAdminAny());
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaChecked, setMfaChecked] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [adminGateRequired, setAdminGateRequired] = useState(false);
  const [adminGateChecked, setAdminGateChecked] = useState(false);

  const initialLoadedRef = useRef(false);
  const hydratedUserRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await withTimeout(
        Promise.resolve(supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle()) as Promise<any>,
        NET_TIMEOUT,
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
        NET_TIMEOUT,
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
    // Check cached value first for immediate UI responsiveness
    const cached = isCachedAdmin(userId);
    if (cached) {
      setIsAdmin(true);
    }
    try {
      // IMPORTANT: use a sentinel so a network timeout is NOT confused with
      // "this user is not an admin" (that used to kick the admin out of the panel).
      const TIMED_OUT = Symbol("timeout");
      const result: any = await withTimeout<any>(
        Promise.resolve(supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle()) as Promise<any>,
        NET_TIMEOUT,
        TIMED_OUT as any
      );
      if (result === TIMED_OUT || result?.error) {
        // Network problem: keep whatever we knew before instead of demoting the user.
        setIsAdmin(cached);
        return cached;
      }
      const isAdm = !!result?.data;
      setIsAdmin(isAdm);
      setCachedAdmin(userId, isAdm);
      return isAdm;
    } catch {
      setIsAdmin(cached);
      return cached;
    }
  };

  const evaluateAdminGate = useCallback(async (sess: Session | null, adminFlag: boolean) => {
    if (!sess || !adminFlag) {
      setAdminGateRequired(false);
      setAdminGateChecked(true);
      return;
    }

    // If already verified in this session or device, gate is unlocked!
    if (isAdminSessionUnlocked(sess.user.id)) {
      setAdminGateRequired(false);
      setAdminGateChecked(true);
      return;
    }

    // Check trusted device token as fallback
    const trusted = readTrustedDevice();
    if (trusted) {
      setAdminSessionUnlocked(sess.user.id);
      setAdminGateRequired(false);
      setAdminGateChecked(true);
      return;
    }

    // Require authenticator confirmation
    setAdminGateRequired(true);
    setAdminGateChecked(true);
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
      const { data } = await withTimeout(
        supabase.auth.mfa.listFactors(),
        NET_TIMEOUT,
        { data: { totp: [] }, error: null } as any
      );
      const verifiedTotp = (data?.totp || []).filter((f: any) => f.status === "verified");
      setMfaEnabled(verifiedTotp.length > 0);
      setNeedsMfa(false);
    } catch {
      setMfaEnabled(false);
      setNeedsMfa(false);
    } finally {
      setMfaChecked(true);
    }
  }, []);

  const unlockAdminGate = useCallback(() => {
    if (user) {
      setAdminSessionUnlocked(user.id);
      const deviceToken = randomDeviceToken();
      const expiresAt = new Date(Date.now() + ADMIN_OTP_TRUST_DAYS * 24 * 60 * 60 * 1000).toISOString();
      saveTrustedDevice(deviceToken, expiresAt);
    }
    setAdminGateRequired(false);
    setAdminGateChecked(true);
  }, [user]);

  useEffect(() => {
    let mounted = true;
    let initTimeout: number | null = null;

    // Safety net: never leave the app stuck on the loading screen.
    initTimeout = window.setTimeout(() => {
      if (mounted) {
        setLoading(false);
        setMfaChecked(true);
        setAdminGateChecked(true);
      }
    }, 6000);

    // Loads profile/ban/role/mfa for a session. Always resolves.
    const hydrate = async (sess: Session) => {
      const admin = await checkAdmin(sess.user.id).catch(() => false);
      await Promise.all([
        fetchProfile(sess.user.id).catch(() => null),
        checkBan(sess.user.id).catch(() => null),
        evaluateMfa(sess).catch(() => null),
        evaluateAdminGate(sess, !!admin).catch(() => null),
      ]);
    };

    const init = async () => {
      try {
        const TIMED_OUT = Symbol("timeout");
        const res: any = await withTimeout<any>(
          supabase.auth.getSession() as Promise<any>,
          8000,
          TIMED_OUT as any
        );
        if (!mounted) return;

        // On timeout we must NOT wipe the session — doing that was logging
        // the user out on slow connections. onAuthStateChange will fill it in.
        if (res === TIMED_OUT) {
          console.warn("getSession timed out — keeping current session state");
          return;
        }

        const sess: Session | null = res?.data?.session ?? null;
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          // onAuthStateChange (INITIAL_SESSION) may have hydrated already.
          if (hydratedUserRef.current !== sess.user.id) {
            hydratedUserRef.current = sess.user.id;
            await hydrate(sess);
          }
        } else {
          setMfaChecked(true);
          setAdminGateChecked(true);
          setAdminGateRequired(false);
        }
      } catch (e) {
        console.error("Auth init error", e);
        setMfaChecked(true);
        setAdminGateChecked(true);
      } finally {
        if (mounted) {
          initialLoadedRef.current = true;
          setLoading(false);
          if (initTimeout) clearTimeout(initTimeout);
        }
      }
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted) return;

      // The callback body must stay synchronous. Calling other supabase
      // methods (and awaiting them) inside this callback can deadlock the
      // client's internal lock — that was the "site fica carregando pra sempre"
      // and "me tira da conta" bug. Heavy work is deferred below.
      setSession(sess);
      // Keep the SAME user object while the id doesn't change. A new object on
      // every focus/token refresh made every effect keyed on `user` re-run,
      // which is why the whole page looked like it was reloading by itself.
      setUser((prev) => (prev && sess?.user && prev.id === sess.user.id ? prev : sess?.user ?? null));

      if (sess?.user) {
        // DO NOT set loading=true on background token refreshes or window focus events!
        // Only set loading if initial load has not finished yet
        if (!initialLoadedRef.current) {
          setLoading(true);
        }

        // Any event for a user we already hydrated (TOKEN_REFRESHED, SIGNED_IN
        // fired on tab focus, INITIAL_SESSION, USER_UPDATED...) must NOT trigger
        // a full reload — that is what made the page "atualizar sozinha" every
        // time the browser was reopened.
        if (hydratedUserRef.current === sess.user.id) return;

        hydratedUserRef.current = sess.user.id;

        setTimeout(() => {
          if (!mounted) return;
          void hydrate(sess)
            .catch(() => null)
            .finally(() => {
              if (mounted && !initialLoadedRef.current) {
                initialLoadedRef.current = true;
                setLoading(false);
                if (initTimeout) clearTimeout(initTimeout);
              }
            });
        }, 0);
      } else {
        // No session (signed out / session expired)
        hydratedUserRef.current = null;
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
    
    if (data.session) {
      const admin = await checkAdmin(data.session.user.id);
      void evaluateMfa(data.session);
      void evaluateAdminGate(data.session, admin);
    }
    return { error: null };
  };

  const verifyMfa = async (code: string) => {
    const cleanCode = code.replace(/\D/g, "").slice(0, 6);
    if (cleanCode.length !== 6) return { error: "Digite o código de 6 dígitos." };

    const doVerify = async (cid: string, fid: string) => {
      const { data, error } = await supabase.auth.mfa.verify({
        factorId: fid,
        challengeId: cid,
        code: cleanCode,
      });
      if (error) return { error: friendlyMfaError(error.message) };
      if ((data as any)?.session) {
        setSession((data as any).session);
        setUser((data as any).session.user);
      }
      setNeedsMfa(false);
      setChallengeId(null);
      setMfaEnabled(true);
      
      // Unlock admin session
      if (user) {
        setAdminSessionUnlocked(user.id);
      }
      setAdminGateRequired(false);
      setAdminGateChecked(true);
      return { error: null };
    };

    try {
      const factors = await listFactors();
      const verified = factors.find((f: any) => f.status === "verified");
      if (!verified) return { error: "Nenhum autenticador configurado. Toque em 'Reconfigurar / Gerar novo QR Code' para criar um." };
      
      const chal = await supabase.auth.mfa.challenge({ factorId: verified.id });
      if (chal.error || !chal.data?.id) return { error: friendlyMfaError(chal.error?.message || "Falha ao validar autenticador.") };
      setChallengeId(chal.data.id);
      return await doVerify(chal.data.id, verified.id);
    } catch (e: any) {
      return { error: friendlyMfaError(e?.message) };
    }
  };

  // Asks the backend (service role) to delete every MFA factor of the current
  // admin. This is the ONLY way out when the authenticator app was lost:
  // Supabase requires an AAL2 session to unenroll a verified factor, so the
  // browser alone can never recover — it just kept returning the same error.
  // Current assurance level of the session. Deleting / replacing a verified
  // TOTP factor requires "aal2" — i.e. a code typed in this session.
  const getAal = useCallback(async (): Promise<string> => {
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      return (data?.currentLevel as string) || "aal1";
    } catch {
      return "aal1";
    }
  }, []);

  const needsCodeToManageMfa = useCallback(async (): Promise<boolean> => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const hasVerified = (data?.totp || []).some((f: any) => f.status === "verified");
      if (!hasVerified) return false;
      return (await getAal()) !== "aal2";
    } catch {
      return false;
    }
  }, [getAal]);

  // Types the 6-digit code from the app to raise the session to aal2, which
  // unlocks "excluir" and "gerar novo QR Code" without any backend deploy.
  const elevateWithCode = useCallback(async (code: string): Promise<{ error: string | null }> => {
    const cleanCode = code.replace(/\D/g, "").slice(0, 6);
    if (cleanCode.length !== 6) return { error: "Digite o código de 6 dígitos." };
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verified = (factorsData?.totp || []).find((f: any) => f.status === "verified");
      if (!verified) return { error: null }; // nothing to elevate against
      const chal = await supabase.auth.mfa.challenge({ factorId: verified.id });
      if (chal.error || !chal.data?.id) return { error: friendlyMfaError(chal.error?.message) };
      const { error } = await supabase.auth.mfa.verify({
        factorId: verified.id,
        challengeId: chal.data.id,
        code: cleanCode,
      });
      if (error) return { error: friendlyMfaError(error.message) };
      return { error: null };
    } catch (e: any) {
      return { error: friendlyMfaError(e?.message) };
    }
  }, []);

  const resetMfaOnServer = async (): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-login", {
        body: { action: "reset_mfa" },
      });
      if (error) {
        return { error: "Servidor indisponível no momento. Tente novamente em instantes." };
      }
      if (data?.error) {
        const msg = String(data.error);
        if (msg.toLowerCase().includes("ação inválida")) {
          return {
            error:
              "Digite o código atual do autenticador para liberar a troca (o reset automático pelo servidor ainda não foi publicado no Supabase).",
          };
        }
        return { error: msg };
      }
      return { error: null };
    } catch (e: any) {
      return { error: e?.message || "Não foi possível falar com o servidor." };
    }
  };

  const resetMfa = async (): Promise<{ error: string | null }> => {
    const res = await resetMfaOnServer();
    if (!res.error) {
      await supabase.auth.refreshSession().catch(() => null);
      setMfaEnabled(false);
      setNeedsMfa(false);
      try {
        localStorage.removeItem(ENROLL_STORAGE_KEY);
      } catch {}
    }
    return res;
  };

  const enrollTotpStart = async (): Promise<{ data: TotpEnroll | null; error: string | null }> => {
    const runEnroll = async () => {
      const uniqueName = `ZXMAX-${Date.now().toString().slice(-6)}`;
      return await supabase.auth.mfa.enroll({
        factorType: "totp" as any,
        friendlyName: uniqueName,
        issuer: "ZXMAX",
      } as any);
    };

    // Errors that mean "there is already a verified factor and this session is
    // only AAL1", i.e. the client alone can never fix it — the server must
    // delete the old factor with the service role.
    const needsServerReset = (msg: string) => {
      const m = (msg || "").toLowerCase();
      return (
        m.includes("aal2") ||
        m.includes("insufficient") ||
        m.includes("exceed") ||
        m.includes("limit") ||
        m.includes("already exists") ||
        m.includes("already enrolled") ||
        m.includes("factor_name_conflict") ||
        m.includes("403")
      );
    };

    try {
      // 1. Try to purge existing factors client-side (works while the session
      //    has no *verified* factor, or when it is already AAL2).
      try {
        const { data: existing } = await supabase.auth.mfa.listFactors();
        for (const f of existing?.totp || []) {
          await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
        }
      } catch {}

      // 2. Enroll a clean TOTP factor
      let { data, error } = await runEnroll();

      // 3. Blocked by an old/lost authenticator? Ask the server to wipe it and retry.
      if ((error || !data) && needsServerReset(error?.message || "")) {
        const reset = await resetMfaOnServer();
        if (reset.error) {
          return {
            data: null,
            error:
              "Não foi possível remover o autenticador antigo automaticamente. " +
              reset.error,
          };
        }
        // Refresh the JWT so it no longer carries the old factor state.
        await supabase.auth.refreshSession().catch(() => null);
        ({ data, error } = await runEnroll());
      }

      if (error || !data) {
        return { data: null, error: friendlyMfaError(error?.message) };
      }

      return {
        data: {
          id: data.id,
          qr: data.totp.qr_code,
          secret: data.totp.secret,
        },
        error: null,
      };
    } catch (e: any) {
      return { data: null, error: friendlyMfaError(e?.message) };
    }
  };

  const enrollTotpVerify = async (factorId: string, code: string) => {
    const cleanCode = code.replace(/\D/g, "").slice(0, 6);
    if (cleanCode.length !== 6) return { error: "Digite o código de 6 dígitos." };

    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error || !challenge.data) return { error: friendlyMfaError(challenge.error?.message || "Falha ao gerar desafio.") };

      const verify = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: cleanCode });
      if (verify.error) return { error: friendlyMfaError(verify.error.message || "Código inválido.") };
      
      setMfaEnabled(true);
      setNeedsMfa(false);
      setMfaChecked(true);

      if ((verify.data as any)?.session) {
        setSession((verify.data as any).session);
        setUser((verify.data as any).session.user);
      }

      // Unlock admin session
      if (user) {
        setAdminSessionUnlocked(user.id);
      }
      setAdminGateRequired(false);
      setAdminGateChecked(true);

      return { error: null };
    } catch (e: any) {
      return { error: e?.message || "Erro ao verificar código" };
    }
  };

  const unenrollTotp = async (factorId?: string) => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const allTotp = factors?.totp || [];
      const toDelete = factorId ? allTotp.filter((f: any) => f.id === factorId) : allTotp;

      let blocked = false;
      for (const f of toDelete) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (error) blocked = true;
      }

      // A verified factor can only be removed by an AAL2 session; fall back to
      // the server-side reset so the admin is never locked out.
      if (blocked) {
        const reset = await resetMfaOnServer();
        if (reset.error) return { error: reset.error };
        await supabase.auth.refreshSession().catch(() => null);
      }

      setMfaEnabled(false);
      setNeedsMfa(false);

      try {
        localStorage.removeItem(ENROLL_STORAGE_KEY);
      } catch {}

      return { error: null };
    } catch (e: any) {
      return { error: e?.message || "Erro ao desativar autenticador." };
    }
  };

  const listFactors = async (): Promise<Factor[]> => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      return data?.totp || [];
    } catch {
      return [];
    }
  };

  const refreshAdminGate = async () => {
    await evaluateAdminGate(session, isAdmin);
  };

  const signOut = async () => {
    clearAdminSessionUnlocked();
    clearTrustedDevice();
    if (user) {
      setCachedAdmin(user.id, false);
    }
    try {
      localStorage.removeItem(ENROLL_STORAGE_KEY);
    } catch {}

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
      user, profile, session, loading, banned,
      // The cached admin flag is only meaningful while somebody is logged in.
      isAdmin: isAdmin && !!user,
      mfaEnabled, needsMfa, mfaChecked,
      adminGateRequired, adminGateChecked, unlockAdminGate,
      signUp, signIn, verifyMfa,
      enrollTotpStart, enrollTotpVerify, unenrollTotp, listFactors, resetMfa,
      needsCodeToManageMfa, elevateWithCode,
      refreshAdminGate,
      signOut, refreshProfile, updateProfile: updateProfileFn,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
