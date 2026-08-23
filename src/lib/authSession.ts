const ADMIN_ROLE_CACHE_PREFIX = "zxmax_admin_role_";
const ADMIN_GATE_PREFIX = "zxmax_admin_gate_ok_";

export function readAdminCache(userId: string): boolean {
  try { return localStorage.getItem(ADMIN_ROLE_CACHE_PREFIX + userId) === "1"; } catch { return false; }
}
export function writeAdminCache(userId: string, isAdmin: boolean) {
  try { if (isAdmin) localStorage.setItem(ADMIN_ROLE_CACHE_PREFIX + userId, "1"); else localStorage.removeItem(ADMIN_ROLE_CACHE_PREFIX + userId); } catch { /* storage unavailable */ }
}
export function readAdminGate(userId: string): boolean {
  try { return !!localStorage.getItem(ADMIN_GATE_PREFIX + userId); } catch { return false; }
}
export function writeAdminGate(userId: string) {
  try { localStorage.setItem(ADMIN_GATE_PREFIX + userId, String(Date.now())); } catch { /* storage unavailable */ }
}
export function clearAdminGate(userId: string) {
  try { localStorage.removeItem(ADMIN_GATE_PREFIX + userId); } catch { /* storage unavailable */ }
}

/** Remove every browser-side credential/cache that can make a logged-out UI reappear. */
export function wipePersistedAuth(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if ((key.startsWith("sb-") && key.includes("auth")) || key.startsWith(ADMIN_ROLE_CACHE_PREFIX) || key.startsWith(ADMIN_GATE_PREFIX) || key === "zxmax_mfa_enroll") localStorage.removeItem(key);
    }
    sessionStorage.removeItem("zxmax_admin_mfa_verified");
  } catch { /* storage unavailable */ }
}

/** Read Supabase's persisted session without asking the auth client to acquire its lock. */
export function peekStoredSession<T = any>(): T | null {
  try {
    const key = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k));
    const raw = key && localStorage.getItem(key);
    const parsed = raw && JSON.parse(raw);
    return parsed?.user && parsed?.access_token ? parsed as T : null;
  } catch { return null; }
}
