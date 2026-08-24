/**
 * Traduz o erro de uma chamada Supabase/PostgREST de perguntas de anúncio em
 * mensagem segura para o usuário final.
 *
 * Contrato (igual ao de `productErrors.ts`):
 * - o objeto de erro COMPLETO vai apenas para o console (ferramenta de dev);
 * - a string retornada é uma frase humana fixa — sem SQL, sem nome de
 *   função/tabela, sem tokens, sem stack trace;
 * - mensagens que o próprio backend/RPC produz em PT-BR (login obrigatório,
 *   contato externo bloqueado, permissão) são repassadas, pois já são seguras
 *   e acionáveis.
 */

export interface SupabaseLikeError {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number | null;
}

export const QUESTIONS_UPDATE_MESSAGE =
  "O recurso de perguntas está sendo atualizado. Tente novamente em alguns minutos.";

/** Mensagens PT-BR que o servidor (RPC) produz e podem ir direto ao usuário. */
const SERVER_MESSAGES: RegExp[] = [
  /^Faça login para enviar uma pergunta\./,
  /^Faça login para responder\./,
  /^Não é permitido enviar contatos externos/,
  /^Este anúncio não está disponível para perguntas\./,
  /^Você não tem permissão para responder esta pergunta\./,
];

/** PostgREST: objeto (tabela/view) ausente do schema — banco desatualizado. */
export function isSchemaMissing(error: SupabaseLikeError | null | undefined): boolean {
  const code = error?.code || "";
  const message = String(error?.message || "");
  return (
    code === "PGRST202" ||
    code === "PGRST205" ||
    /Could not find the (function|table|column)/i.test(message)
  );
}

/**
 * Classifica a falha e devolve a mensagem a exibir. `context` diferencia o
 * toast de enviar pergunta de responder.
 */
export function friendlyQuestionError(
  error: SupabaseLikeError | null | undefined,
  context: "ask" | "answer" | "load" = "ask",
): string {
  if (!error) {
    return context === "answer"
      ? "Não foi possível enviar a resposta agora. Tente novamente em alguns instantes."
      : QUESTIONS_UPDATE_MESSAGE;
  }

  // Detalhe completo só no console — nunca no toast.
  // eslint-disable-next-line no-console
  console.error(`[zxmax:questions:${context}]`, error);

  if (isSchemaMissing(error)) return QUESTIONS_UPDATE_MESSAGE;

  const message = String(error.message || "");

  // Mensagens PT-BR emitidas pelo próprio RPC — seguras por construção.
  if (SERVER_MESSAGES.some((re) => re.test(message))) return message;

  // Sessão expirada / sem permissão no nível do PostgREST.
  if (error.status === 401 || error.code === "42501" && /JWT|token|auth/i.test(message)) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }
  if (error.status === 403) {
    return "Você não tem permissão para esta ação.";
  }
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message)) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }

  return context === "answer"
    ? "Não foi possível enviar a resposta agora. Tente novamente em alguns instantes."
    : "Não foi possível enviar a pergunta agora. Tente novamente em alguns instantes.";
}
