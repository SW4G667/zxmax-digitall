const FALLBACK_ORIGIN = "http://localhost:5173";

function runtimeOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return FALLBACK_ORIGIN;
}

export function normalizeAppOrigin(origin = runtimeOrigin()): string {
  try {
    return new URL(origin).origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

export function getAppUrl(path = "/", origin?: string): string {
  const base = `${normalizeAppOrigin(origin ?? runtimeOrigin())}/`;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(cleanPath, base).toString();
}

/**
 * Vercel preview URLs use generated hosts (for example *-projects.vercel.app
 * or *-git-*.vercel.app). They are useful for QA, but real credentials should
 * be entered on the stable production/custom domain instead.
 */
export function isGeneratedVercelPreviewHost(hostname?: string): boolean {
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")).toLowerCase();
  if (!host.endsWith(".vercel.app")) return false;
  return host.endsWith("-projects.vercel.app") || host.includes("-git-");
}
