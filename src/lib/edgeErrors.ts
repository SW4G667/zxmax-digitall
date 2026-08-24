/**
 * Extrai a mensagem real de uma falha de `supabase.functions.invoke`.
 *
 * O supabase-js embrulha respostas não-2xx num `FunctionsHttpError` cuja
 * `message` é sempre "Edge Function returned a non-2xx status code". A causa
 * verdadeira (ex.: "Stripe não configurado") fica no corpo da resposta, em
 * `error.context`, e precisa ser lida de forma assíncrona.
 *
 * Sem isto, todo erro de pagamento vira uma mensagem genérica — foi o que
 * escondeu a falha do checkout com cartão.
 */

export interface EdgeCallResult<T = unknown> {
  data: T | null;
  /** Mensagem pronta para exibição, ou null quando a chamada deu certo. */
  errorMessage: string | null;
  /** Código estável devolvido pela função, quando houver. */
  code: string | null;
  status: number | null;
}

const FRIENDLY: Record<string, string> = {
  Unauthorized: "Sua sessão expirou. Entre novamente para concluir a compra.",
  "Failed to fetch": "Falha de conexão. Verifique sua internet e tente novamente.",
  "Failed to send a request to the Edge Function":
    "O serviço de pagamento não respondeu. Se o problema continuar, avise o suporte.",
};

/** Lê o corpo JSON de um erro de Edge Function sem nunca lançar. */
async function readErrorBody(error: unknown): Promise<Record<string, unknown> | null> {
  const context = (error as { context?: unknown })?.context;
  if (!context) return null;
  // `context` é um Response nas versões atuais do supabase-js.
  if (typeof (context as Response).json === "function") {
    try {
      return (await (context as Response).clone().json()) as Record<string, unknown>;
    } catch {
      try {
        const text = await (context as Response).clone().text();
        return text ? { error: text } : null;
      } catch {
        return null;
      }
    }
  }
  if (typeof context === "object") return context as Record<string, unknown>;
  return null;
}

/**
 * Normaliza o resultado de `functions.invoke`, trazendo a mensagem real do
 * servidor. `fallback` é usado quando a função não explicou o motivo.
 */
export async function unwrapEdgeCall<T = unknown>(
  result: { data: unknown; error: unknown },
  fallback: string,
): Promise<EdgeCallResult<T>> {
  const { data, error } = result;

  if (error) {
    const body = await readErrorBody(error);
    const status = Number((error as { context?: { status?: number } })?.context?.status ?? 0) || null;
    const raw =
      (typeof body?.error === "string" && body.error) ||
      (typeof body?.message === "string" && body.message) ||
      "";
    const rawMessage = raw || String((error as Error)?.message ?? "");
    // Log completo só para o desenvolvedor.
    // eslint-disable-next-line no-console
    console.error("[zxmax:edge]", { status, body, error });
    return {
      data: null,
      errorMessage: FRIENDLY[rawMessage] ?? (raw || fallback),
      code: typeof body?.code === "string" ? body.code : null,
      status,
    };
  }

  // Algumas funções respondem 200 com `{ error: "..." }` no corpo.
  const payload = data as Record<string, unknown> | null;
  if (payload && typeof payload.error === "string" && payload.error) {
    // eslint-disable-next-line no-console
    console.error("[zxmax:edge]", payload);
    return {
      data: null,
      errorMessage: FRIENDLY[payload.error] ?? payload.error,
      code: typeof payload.code === "string" ? payload.code : null,
      status: 200,
    };
  }

  return { data: (data as T) ?? null, errorMessage: null, code: null, status: 200 };
}
