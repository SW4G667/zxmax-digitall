/**
 * Discord OAuth helpers.
 *
 * The admin configures Client ID / Redirect URI / Scopes in the painel
 * (Admin → APIs & Credenciais, persisted in app_settings.discord). The login
 * button must use EXACTLY those values — and the token exchange must send the
 * exact same redirect_uri used in the authorize URL, otherwise Discord rejects
 * the exchange with "invalid_grant".
 */

export const DISCORD_REDIRECT_STORAGE_KEY = "zxmax_discord_redirect_uri";

export interface DiscordAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string;
}

/** Builds the authorize URL from the saved config (no hardcoded client ID). */
export function buildDiscordAuthorizeUrl(cfg: DiscordAuthConfig): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: cfg.redirectUri,
    scope: cfg.scopes,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/** Remembers the exact redirect_uri used at authorize time so the code
 * exchange sends the identical string. */
export function rememberRedirectUri(redirectUri: string) {
  try {
    sessionStorage.setItem(DISCORD_REDIRECT_STORAGE_KEY, redirectUri);
  } catch { /* noop */ }
}

/** Returns the redirect_uri remembered from the authorize step, if any. */
export function consumeRememberedRedirectUri(): string | null {
  try {
    const v = sessionStorage.getItem(DISCORD_REDIRECT_STORAGE_KEY);
    if (v) {
      sessionStorage.removeItem(DISCORD_REDIRECT_STORAGE_KEY);
      return v;
    }
  } catch { /* noop */ }
  return null;
}
