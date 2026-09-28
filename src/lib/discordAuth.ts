import { getAppUrl } from "@/lib/appUrl";

/**
 * O Discord é configurado no painel Auth do Supabase. O cliente não recebe
 * Client Secret e o callback sempre usa o domínio em que o app está aberto.
 */
export function getDiscordRedirectTo(origin?: string): string {
  return getAppUrl("/auth/callback", origin);
}

export function getDiscordListingRedirectTo(next = "/meus-produtos?new=1", origin?: string): string {
  const query = new URLSearchParams({ intent: "listing", next }).toString();
  return getAppUrl(`/auth/callback?${query}`, origin);
}
