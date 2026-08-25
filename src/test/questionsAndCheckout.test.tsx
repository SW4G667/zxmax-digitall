import React from "react";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";

/**
 * Testes de integração da página /produto/:id — fluxo real de perguntas e
 * checkout, sem tocar no Supabase real.
 *
 * Cenários exigidos (Tarefa B):
 *  - visitante não envia pergunta (abre login);
 *  - usuário autenticado envia pergunta válida;
 *  - pergunta com contato externo é bloqueada (mensagem do RPC do banco);
 *  - vendedor autorizado responde;
 *  - pergunta persiste após "reload" (remount) — nada é simulado localmente;
 *  - erro cru do PostgREST (PGRST202) NUNCA vira toast técnico.
 * Cenários exigidos (Tarefa C/D):
 *  - função antiga publicada (403) ≠ "não configurado": estado de atualização;
 *  - nenhum método ativo: PIX não fica selecionado, botão desabilitado,
 *    sem campo de CPF; modal com rolagem vertical em telas baixas.
 */

const toastMock = vi.hoisted(() => ({
  error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn(), message: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("@/components/AppShell", () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/components/AuthScreen", () => ({ default: () => <div data-testid="auth-screen" /> }));
vi.mock("@/components/UserProfileModal", () => ({ default: () => null }));
vi.mock("@/components/PixPaymentModal", () => ({ default: () => null }));
vi.mock("@/components/CryptoPaymentModal", () => ({ default: () => null }));
vi.mock("@/hooks/useFavorites", () => ({ default: () => ({ isFavorite: () => false, toggle: vi.fn() }) }));

/** Estado controlável do mock do useStore. */
const storeState = vi.hoisted(() => ({ current: {} as any }));

vi.mock("@/store/StoreContext", () => ({
  useStore: () => storeState.current,
}));

/** Respostas controláveis de from()/rpc()/functions.invoke(). */
const db = vi.hoisted(() => ({
  questionsResult: { current: { data: [] as any[], error: null as any } },
  rpcResult: { current: { data: null, error: null as any } },
  rpcCalls: { current: [] as Array<{ name: string; args: any }> },
  edgeResult: { current: { data: null, error: null as any } },
}));

const supabaseMock = vi.hoisted(() => {
  const questionChain: any = {
    select: () => questionChain,
    eq: () => questionChain,
    order: () => Promise.resolve(db.questionsResult.current),
    then: (resolve: any) => Promise.resolve(db.questionsResult.current).then(resolve),
  };
  return {
    from: (table: string) => {
      if (table === "product_questions") return questionChain;
      // profiles update (CPF) e outras tabelas: sucesso silencioso
      const chain: any = {
        select: () => chain, eq: () => chain, update: () => chain, order: () => chain,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return chain;
    },
    rpc: vi.fn(async (name: string, args: any) => {
      db.rpcCalls.current.push({ name, args });
      return db.rpcResult.current;
    }),
    functions: {
      invoke: vi.fn(async () => db.edgeResult.current),
    },
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

// eslint-disable-next-line import/first
import ProdutoPage from "@/pages/Produto";

const SELLER_ID = "seller-uuid";
const PRODUCT = {
  id: 41, name: "Tetse", price: 5, category: "Bots Discord", seller: "Vendedor",
  sellerId: SELLER_ID, approved: true, deliveryType: "manual" as const,
  variations: [], questions: [], sales: 0, image: "https://cdn.example/i.png",
};

const REMOTE_QUESTION = {
  id: 7, body: "Entrega em quanto tempo?", answer: null as string | null,
  created_at: "2026-08-24T10:00:00Z", answered_at: null as string | null,
};

function baseStore(overrides: { state?: Record<string, unknown> } & Record<string, unknown> = {}) {
  const { state: stateOverrides, ...rest } = overrides;
  return {
    state: {
      products: [PRODUCT], purchases: [], currentUser: null, userDirectory: {},
      config: { commission: 10 },
      ...stateOverrides,
    },
    catalogStatus: "ready",
    refreshProducts: vi.fn(),
    refreshPurchases: vi.fn(),
    savePixCharge: vi.fn(),
    buyProduct: vi.fn(async () => 99),
    loadProductReviews: vi.fn(async () => []),
    ...rest,
  };
}

const renderProduto = () =>
  render(
    <MemoryRouter initialEntries={["/produto/41"]}>
      <Routes>
        <Route path="/produto/:id" element={<ProdutoPage />} />
      </Routes>
    </MemoryRouter>,
  );

const typeInto = async (label: RegExp, text: string) => {
  const input = screen.getByLabelText(label);
  await act(async () => {
    fireEvent.change(input, { target: { value: text } });
  });
};

const typeQuestion = (text: string) => typeInto(/faça uma pergunta/i, text);

const clickSend = async () => {
  await act(async () => { screen.getByText("Enviar pergunta").click(); });
};

const openCheckout = async () => {
  await act(async () => { screen.getAllByText("COMPRAR")[0].click(); });
};

beforeEach(() => {
  vi.clearAllMocks();
  storeState.current = baseStore();
  db.questionsResult.current = { data: [], error: null };
  db.rpcResult.current = { data: null, error: null };
  db.rpcCalls.current = [];
  db.edgeResult.current = { data: null, error: null };
});

describe("Perguntas — Tarefa B", () => {
  it("visitante não envia pergunta: abre login em vez de chamar a RPC", async () => {
    renderProduto();
    await waitFor(() => expect(screen.getByText("PERGUNTAS (0)")).toBeTruthy());
    await typeQuestion("Quanto tempo de entrega?");
    await clickSend();
    expect(screen.getByTestId("auth-screen")).toBeTruthy();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("usuário autenticado envia pergunta válida pela RPC do banco", async () => {
    storeState.current = baseStore({ state: { currentUser: { id: "buyer-uuid", name: "Comprador" } } });
    renderProduto();
    await waitFor(() => expect(screen.getByText("PERGUNTAS (0)")).toBeTruthy());
    await typeQuestion("Aceita pagamento no PIX?");
    await clickSend();
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Pergunta enviada ao vendedor."));
    expect(supabaseMock.rpc).toHaveBeenCalledWith("ask_product_question", { _product_id: 41, _body: "Aceita pagamento no PIX?" });
  });

  it("contato externo é bloqueado com a mensagem do banco (validação no servidor)", async () => {
    storeState.current = baseStore({ state: { currentUser: { id: "buyer-uuid", name: "Comprador" } } });
    db.rpcResult.current = {
      data: null,
      error: { code: "22023", message: "Não é permitido enviar contatos externos (WhatsApp, Discord, e-mail, links ou telefone)." },
    };
    renderProduto();
    await waitFor(() => expect(screen.getByText("PERGUNTAS (0)")).toBeTruthy());
    await typeQuestion("me chama no whatsapp 11 99999-9999");
    await clickSend();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(toastMock.error.mock.calls.at(-1)?.[0]).toMatch(/Não é permitido enviar contatos externos/);
  });

  it("erro cru de schema (PGRST202) nunca vira toast técnico", async () => {
    storeState.current = baseStore({ state: { currentUser: { id: "buyer-uuid", name: "Comprador" } } });
    db.rpcResult.current = {
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.ask_product_question(_body, _product_id) in the schema cache" },
    };
    renderProduto();
    await waitFor(() => expect(screen.getByText("PERGUNTAS (0)")).toBeTruthy());
    await typeQuestion("Funciona mesmo?");
    await clickSend();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    const shown = String(toastMock.error.mock.calls.at(-1)?.[0]);
    expect(shown).toBe("O recurso de perguntas está sendo atualizado. Tente novamente em alguns minutos.");
    expect(shown).not.toMatch(/schema cache|ask_product_question|PGRST/i);
  });

  it("banco sem a tabela: composer some, estado honesto, sem botão falso", async () => {
    db.questionsResult.current = {
      data: null,
      error: { code: "PGRST205", message: "Could not find the table 'product_questions' in the schema cache" },
    };
    renderProduto();
    await waitFor(() =>
      expect(screen.getByText(/O recurso de perguntas está sendo atualizado/i)).toBeTruthy());
    expect(screen.queryByLabelText(/faça uma pergunta/i)).toBeNull();
    expect(screen.queryByText("Enviar pergunta")).toBeNull();
  });

  it("vendedor autorizado responde pela RPC answer_product_question", async () => {
    storeState.current = baseStore({ state: { currentUser: { id: SELLER_ID, name: "Vendedor" } } });
    db.questionsResult.current = { data: [REMOTE_QUESTION], error: null };
    renderProduto();
    await waitFor(() => expect(screen.getByText("Entrega em quanto tempo?")).toBeTruthy());
    const answerBox = screen.getByLabelText(/responder pergunta/i);
    await act(async () => {
      fireEvent.change(answerBox, { target: { value: "Entrego em até 2 horas." } });
    });
    await act(async () => { screen.getByText("Responder").click(); });
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Resposta publicada."));
    expect(supabaseMock.rpc).toHaveBeenCalledWith("answer_product_question", { _question_id: 7, _answer: "Entrego em até 2 horas." });
  });

  it("comprador NÃO vê formulário de resposta", async () => {
    storeState.current = baseStore({ state: { currentUser: { id: "buyer-uuid", name: "Comprador" } } });
    db.questionsResult.current = { data: [REMOTE_QUESTION], error: null };
    renderProduto();
    await waitFor(() => expect(screen.getByText("Entrega em quanto tempo?")).toBeTruthy());
    expect(screen.queryByLabelText(/responder pergunta/i)).toBeNull();
  });

  it("pergunta persiste após reload (remount busca no servidor)", async () => {
    db.questionsResult.current = { data: [REMOTE_QUESTION], error: null };
    const { unmount } = renderProduto();
    await waitFor(() => expect(screen.getByText("Entrega em quanto tempo?")).toBeTruthy());
    unmount();
    renderProduto();
    await waitFor(() => expect(screen.getByText("Entrega em quanto tempo?")).toBeTruthy());
  });
});

describe("Checkout — Tarefa C/D", () => {
  const httpError = (status: number, body: unknown) => ({
    data: null,
    error: {
      message: "Edge Function returned a non-2xx status code",
      context: new Response(JSON.stringify(body), { status }),
    },
  });

  it("métodos ativos: PIX selecionável, botão 'Pagar com PIX' habilitado", async () => {
    storeState.current = baseStore({ state: { currentUser: { id: "buyer-uuid", name: "Comprador" } } });
    db.edgeResult.current = { data: { v: 2, methods: { pix: true, crypto: false, card: false, boleto: false } }, error: null };
    renderProduto();
    await waitFor(() => expect(screen.getByText("COMPRAR")).toBeTruthy());
    await openCheckout();
    await waitFor(() => expect(screen.getByText("Pagar com PIX")).toBeTruthy());
    const pixButton = screen.getByText("PIX").closest("button")!;
    expect(pixButton.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Cartão (Stripe)").closest("button")!.getAttribute("aria-pressed")).toBe("false");
    expect((screen.getByText("Pagar com PIX") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("R$ 5,90")).toBeTruthy();
    expect(screen.getByText(/\+ R\$ 0,90/)).toBeTruthy();
  });

  it("nenhum método ativo: nada selecionado, sem CPF, botão desabilitado", async () => {
    storeState.current = baseStore({ state: { currentUser: { id: "buyer-uuid", name: "Comprador" } } });
    db.edgeResult.current = { data: { v: 2, methods: { pix: false, crypto: false, card: false, boleto: false } }, error: null };
    renderProduto();
    await openCheckout();
    await waitFor(() => expect(screen.getByText("Nenhuma forma disponível")).toBeTruthy());
    expect(screen.getByText("PIX").closest("button")!.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByText(/CPF para pagamento/i)).toBeNull();
    expect((screen.getByText("Nenhuma forma disponível") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Nenhuma forma de pagamento está ativa/i)).toBeTruthy();
  });

  it("função antiga publicada (403) vira 'atualizando', não 'não configurado'", async () => {
    storeState.current = baseStore({ state: { currentUser: { id: "buyer-uuid", name: "Comprador" } } });
    db.edgeResult.current = httpError(403, { error: "Apenas administradores." });
    renderProduto();
    await openCheckout();
    await waitFor(() => expect(screen.getByText(/Estamos atualizando os meios de pagamento/i)).toBeTruthy());
    expect(screen.queryByText(/Nenhuma forma de pagamento está configurada/i)).toBeNull();
    expect(screen.getByText("Tentar novamente")).toBeTruthy();
    expect(screen.getByText("PIX").closest("button")!.getAttribute("aria-pressed")).toBe("false");
  });

  it("falha ao ler app_settings (503) tem mensagem e retry próprios", async () => {
    storeState.current = baseStore({ state: { currentUser: { id: "buyer-uuid", name: "Comprador" } } });
    db.edgeResult.current = httpError(503, { error: "Não foi possível verificar as formas de pagamento agora. Tente novamente em instantes.", code: "payment_settings_unavailable" });
    renderProduto();
    await openCheckout();
    await waitFor(() => expect(screen.getByText(/Não foi possível verificar as formas de pagamento agora/i)).toBeTruthy());
    expect(screen.getByText("Tentar novamente")).toBeTruthy();
  });

  it("modal rolável e acima da navegação inferior (mobile)", async () => {
    storeState.current = baseStore({ state: { currentUser: { id: "buyer-uuid", name: "Comprador" } } });
    db.edgeResult.current = { data: { v: 2, methods: { pix: true, crypto: false, card: false, boleto: false } }, error: null };
    renderProduto();
    await openCheckout();
    await waitFor(() => expect(screen.getByText("Pagar com PIX")).toBeTruthy());
    const dialog = screen.getByRole("dialog", { name: /checkout zxmax/i });
    const panel = dialog.firstElementChild as HTMLElement;
    expect(panel.className).toContain("overflow-y-auto");
    expect(panel.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(dialog.className).toContain("z-[80]"); // acima do BottomNav (z-50)
  });
});
