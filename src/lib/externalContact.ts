/**
 * Validação no cliente de contatos externos (WhatsApp, Discord, e-mail, telefone, links).
 * A validação autoritativa é sempre feita no servidor (Postgres RPC + Edge Function).
 */
export function containsExternalContact(text: string): boolean {
  if (!text) return false;
  const clean = text.toLowerCase();

  // Links, domínios, e-mails
  if (/(https?:\/\/|www\.|\.com\b|\.gg\/|@[^[:space:]]+\.[a-z]{2,})/.test(clean)) {
    return true;
  }

  // Números de telefone / celular (8+ dígitos de padrão)
  if (/(^|[^0-9])[0-9][0-9 .()_-]{7,}[0-9]([^0-9]|$)/.test(clean)) {
    return true;
  }

  // Palavras-chave de serviços de contato externo
  if (/\b(whats|whatsapp|zap|wpp|vatsapp|discord|telegram|instagram|email|e-mail|gmail|hotmail|outlook|yahoo|telefone|celular|fone)\b/.test(clean)) {
    return true;
  }

  return false;
}
