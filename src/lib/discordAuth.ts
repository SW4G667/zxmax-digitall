/**
 * O Discord é configurado no painel Auth do Supabase. O cliente não monta URLs
 * com Client ID, não recebe Client Secret e não troca códigos manualmente.
 * O SDK usa PKCE/state e trata o retorno no callback definido abaixo.
 */
export function getDiscordRedirectTo(origin = window.location.origin): string {
  return new URL("/auth/callback", origin).toString();
}
