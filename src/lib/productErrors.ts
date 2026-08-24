/**
 * Translates the error a Supabase/PostgREST call returns into a message a
 * Brazilian seller can act on.
 *
 * Contract:
 * - the *full* error object is only ever written to the console (developer
 *   tooling), never rendered;
 * - the returned string is a fixed, human phrase — no SQL, no column names,
 *   no tokens, no stack traces.
 */

export interface SupabaseLikeError {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number | null;
}

export const GENERIC_PRODUCT_ERROR =
  "Não foi possível salvar o anúncio agora. Tente novamente em alguns instantes.";

const MESSAGES = {
  session: "Sua sessão expirou. Entre novamente para publicar o anúncio.",
  notVerified: "Sua conta ainda não está verificada como vendedor. Conclua a verificação para anunciar.",
  forbidden: "Você não tem permissão para esta ação. Se acabou de se verificar, saia e entre novamente.",
  approvalDenied: "Apenas administradores podem aprovar anúncios. O seu foi enviado para análise.",
  price: "Preço inválido. Use um valor a partir de R$ 2,00 (ex.: 2,00).",
  required: "Preencha todos os campos obrigatórios do anúncio.",
  duplicate: "Já existe um anúncio igual a este.",
  schema: "O sistema está sendo atualizado. Avise o suporte: o banco de dados precisa receber as migrations.",
  network: "Falha de conexão. Verifique sua internet e tente novamente.",
  unavailable: "O serviço está temporariamente indisponível. Tente novamente em instantes.",
  rateLimit: "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.",
} as const;

/** Safe, low-cardinality label for logs/metrics (never shown to the user). */
export type ProductErrorKind =
  | "session"
  | "notVerified"
  | "forbidden"
  | "approvalDenied"
  | "price"
  | "required"
  | "duplicate"
  | "schema"
  | "network"
  | "unavailable"
  | "rateLimit"
  | "unknown";

export function classifyProductError(error: SupabaseLikeError | null | undefined): ProductErrorKind {
  if (!error) return "unknown";
  const code = String(error.code ?? "");
  const status = Number(error.status ?? 0);
  const text = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();

  if (status === 401 || code === "PGRST301" || text.includes("jwt") || text.includes("not authenticated")) return "session";
  if (status === 429 || code === "429" || text.includes("too many requests") || text.includes("rate limit")) return "rateLimit";
  if (text.includes("failed to fetch") || text.includes("networkerror") || text.includes("network request failed") || code === "ERR_NETWORK") return "network";
  if (status === 503 || status === 502 || status === 504 || text.includes("upstream") || text.includes("service unavailable")) return "unavailable";

  // Postgres SQLSTATEs surfaced by PostgREST.
  if (code === "42501" || status === 403 || text.includes("row-level security") || text.includes("permission denied")) {
    if (text.includes("verific")) return "notVerified";
    return "forbidden";
  }
  if (text.includes("apenas administradores podem aprovar")) return "approvalDenied";
  if (code === "23514" || text.includes("preço mínimo") || text.includes("preco minimo") || text.includes("products_minimum_price")) return "price";
  if (code === "22003" || code === "22P02") return "price";
  if (code === "23502") return "required";
  if (code === "23505") return "duplicate";
  if (code === "42703" || code === "42P01" || code === "PGRST204" || code === "PGRST205" || text.includes("does not exist")) return "schema";
  if (code === "23503") return "forbidden";
  return "unknown";
}

/** Friendly, non-sensitive message for a failed product write. */
export function productErrorMessage(error: SupabaseLikeError | null | undefined): string {
  const kind = classifyProductError(error);
  if (kind === "unknown") return GENERIC_PRODUCT_ERROR;
  return MESSAGES[kind];
}

/** Log the raw error for developers without ever putting it on screen. */
export function logProductError(scope: string, error: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[zxmax:${scope}]`, error);
}
