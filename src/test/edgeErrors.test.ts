import { describe, expect, it, vi } from "vitest";
import { unwrapEdgeCall } from "@/lib/edgeErrors";

/**
 * O supabase-js embrulha respostas não-2xx num FunctionsHttpError cuja message
 * é sempre "Edge Function returned a non-2xx status code". A causa real fica no
 * corpo. Era isso que escondia o motivo da falha no checkout com cartão.
 */
const httpError = (status: number, body: unknown) => ({
  message: "Edge Function returned a non-2xx status code",
  context: new Response(JSON.stringify(body), { status }),
});

describe("unwrapEdgeCall", () => {
  it("devolve os dados quando a chamada dá certo", async () => {
    const res = await unwrapEdgeCall<{ url: string }>({ data: { url: "https://pay" }, error: null }, "falhou");
    expect(res.errorMessage).toBeNull();
    expect(res.data?.url).toBe("https://pay");
  });

  it("extrai a mensagem real do corpo em vez do texto genérico", async () => {
    const res = await unwrapEdgeCall(
      { data: null, error: httpError(400, { error: "Stripe não configurado", code: "stripe_not_configured" }) },
      "fallback",
    );
    expect(res.errorMessage).toBe("Stripe não configurado");
    expect(res.errorMessage).not.toMatch(/non-2xx/);
    expect(res.code).toBe("stripe_not_configured");
    expect(res.status).toBe(400);
  });

  it("reconhece o erro de chave publicável colada no lugar da secreta", async () => {
    const res = await unwrapEdgeCall(
      { data: null, error: httpError(400, { error: "A chave cadastrada não é uma Secret Key da Stripe.", code: "stripe_wrong_key" }) },
      "fallback",
    );
    expect(res.code).toBe("stripe_wrong_key");
    expect(res.errorMessage).toMatch(/Secret Key/);
  });

  it("trata função que responde 200 com { error }", async () => {
    const res = await unwrapEdgeCall({ data: { error: "Pedido não está pendente" }, error: null }, "fallback");
    expect(res.data).toBeNull();
    expect(res.errorMessage).toBe("Pedido não está pendente");
  });

  it("usa o fallback quando o corpo não explica nada", async () => {
    const res = await unwrapEdgeCall({ data: null, error: httpError(500, {}) }, "Não foi possível iniciar o pagamento.");
    expect(res.errorMessage).toBe("Não foi possível iniciar o pagamento.");
  });

  it("traduz sessão expirada e falha de rede", async () => {
    const unauth = await unwrapEdgeCall({ data: null, error: httpError(401, { error: "Unauthorized" }) }, "fallback");
    expect(unauth.errorMessage).toMatch(/sessão expirou/i);

    const offline = await unwrapEdgeCall({ data: null, error: { message: "Failed to fetch" } }, "fallback");
    expect(offline.errorMessage).toMatch(/conexão/i);
  });

  it("não quebra quando o corpo não é JSON", async () => {
    const res = await unwrapEdgeCall(
      { data: null, error: { message: "erro", context: new Response("<html>502</html>", { status: 502 }) } },
      "fallback",
    );
    expect(res.errorMessage).toBeTruthy();
    expect(res.data).toBeNull();
  });

  it("registra o erro completo no console, mas não o devolve para a tela", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await unwrapEdgeCall(
      { data: null, error: httpError(500, { stack: "at Object.<anonymous> (/srv/index.ts:42)" }) },
      "Não foi possível iniciar o pagamento.",
    );
    expect(spy).toHaveBeenCalled();
    expect(res.errorMessage).not.toContain("index.ts");
    spy.mockRestore();
  });
});
