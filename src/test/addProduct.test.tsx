import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fase 1 + Fase 7 — testes de integração do fluxo real de criação de produto.
 *
 * O objetivo é provar, sem tocar no Supabase real, que:
 *  - o erro devolvido pelo banco vira uma mensagem específica (nunca só
 *    "Tente novamente") e nunca vaza detalhe técnico;
 *  - uma falha não deixa produto-fantasma no catálogo;
 *  - o cliente não decide `approved`, `seller_id`, vendas nem estoque;
 *  - o sucesso recarrega o catálogo a partir do banco.
 */

const toastMock = vi.hoisted(() => ({
  error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn(), message: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMock }));

const authState = vi.hoisted(() => ({
  user: { id: "seller-uuid", email: "vendedor@zxmax.dev", user_metadata: {} },
  profile: {
    user_id: "seller-uuid", public_id: 123456, email: "vendedor@zxmax.dev",
    display_name: "Vendedor", avatar_url: "", pix_key: "", is_verified_seller: true, document_type: "",
  },
  isAdmin: false,
  signOut: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState, AuthProvider: ({ children }: any) => children }));

/** Rows returned by any `from(table).select()` chain. */
const tableRows = vi.hoisted(() => ({ current: {} as Record<string, unknown[]> }));
/** Result the next `products.insert()` must return. */
const insertResult = vi.hoisted(() => ({ current: { data: null as any, error: null as any } }));
const insertPayloads = vi.hoisted(() => ({ current: [] as Record<string, unknown>[] }));

const supabaseMock = vi.hoisted(() => {
  const makeQuery = (table: string) => {
    const rows = () => tableRows.current[table] ?? [];
    const thenable: any = {
      select: () => thenable,
      eq: () => thenable,
      neq: () => thenable,
      order: () => thenable,
      limit: () => thenable,
      maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      insert: (payload: Record<string, unknown>) => {
        insertPayloads.current.push(payload);
        const result = insertResult.current;
        const chain: any = {
          select: () => chain,
          maybeSingle: () => Promise.resolve(result),
          single: () => Promise.resolve(result),
          then: (resolve: any) => Promise.resolve(result).then(resolve),
        };
        return chain;
      },
      update: () => thenable,
      upsert: () => Promise.resolve({ data: null, error: null }),
      delete: () => thenable,
      then: (resolve: any) => Promise.resolve({ data: rows(), error: null }).then(resolve),
    };
    return thenable;
  };
  return {
    from: (table: string) => makeQuery(table),
    functions: { invoke: vi.fn(async () => ({ data: { products: [] }, error: null })) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
    storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn() }) },
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

// eslint-disable-next-line import/first
import { StoreProvider, useStore } from "@/store/StoreContext";

const NEW_PRODUCT = {
  name: "Pacote 1000 Robux",
  price: 2,
  category: "Robux e Gift Cards",
  seller: "Vendedor",
  sellerEmail: "vendedor@zxmax.dev",
  image: "https://cdn.example/img.png",
  description: "Entrega rápida",
  deliveryType: "manual" as const,
  variations: [{ name: "1000 Robux", price: 2 }],
};

function Harness({ product = NEW_PRODUCT }: { product?: any }) {
  const { addProduct, state } = useStore();
  const [result, setResult] = React.useState<string>("idle");
  return (
    <div>
      <button onClick={async () => setResult(String(await addProduct(product)))}>criar</button>
      <span data-testid="result">{result}</span>
      <span data-testid="count">{state.products.length}</span>
    </div>
  );
}

const renderHarness = (product?: any) => render(<StoreProvider><Harness product={product} /></StoreProvider>);
const click = async () => { await act(async () => { screen.getByText("criar").click(); }); };

beforeEach(() => {
  vi.clearAllMocks();
  tableRows.current = {};
  insertPayloads.current = [];
  insertResult.current = { data: { id: 42, approved: false }, error: null };
  authState.isAdmin = false;
  authState.profile.is_verified_seller = true;
});

describe("addProduct — mensagens de erro reais", () => {
  it("traduz preço abaixo do mínimo recusado pelo banco", async () => {
    insertResult.current = { data: null, error: { code: "23514", message: "O preço mínimo de um anúncio é R$ 2,00" } };
    renderHarness();
    await click();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(toastMock.error.mock.calls.at(-1)?.[0]).toMatch(/R\$ 2,00/);
    expect(toastMock.error.mock.calls.at(-1)?.[0]).not.toMatch(/Tente novamente\.$/);
  });

  it("traduz sessão expirada", async () => {
    insertResult.current = { data: null, error: { status: 401, message: "JWT expired" } };
    renderHarness();
    await click();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(toastMock.error.mock.calls.at(-1)?.[0]).toMatch(/sessão expirou/i);
  });

  it("traduz falha de rede", async () => {
    insertResult.current = { data: null, error: { message: "TypeError: Failed to fetch" } };
    renderHarness();
    await click();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(toastMock.error.mock.calls.at(-1)?.[0]).toMatch(/conexão/i);
  });

  it("nunca mostra SQL, coluna ou token ao usuário", async () => {
    insertResult.current = {
      data: null,
      error: {
        code: "42501",
        message: 'new row violates row-level security policy for table "products"',
        details: "INSERT INTO public.products ...",
        hint: "Bearer eyJhbGciOi.secret",
      },
    };
    renderHarness();
    await click();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    const shown = String(toastMock.error.mock.calls.at(-1)?.[0]);
    for (const leak of ["row-level", "INSERT", "Bearer", "eyJ", "42501"]) expect(shown).not.toContain(leak);
  });

  it("não deixa produto-fantasma no catálogo após falha", async () => {
    insertResult.current = { data: null, error: { code: "23514", message: "preço mínimo" } };
    renderHarness();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));
    await click();
    expect(screen.getByTestId("result").textContent).toBe("false");
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});

describe("addProduct — validações antes de chegar ao banco", () => {
  it("bloqueia preço abaixo de R$ 2,00 sem chamar o insert", async () => {
    renderHarness({ ...NEW_PRODUCT, price: 1.99 });
    await click();
    expect(insertPayloads.current).toHaveLength(0);
    expect(toastMock.error.mock.calls.at(-1)?.[0]).toMatch(/R\$ 2,00/);
  });

  it("bloqueia vendedor não verificado com mensagem específica", async () => {
    authState.profile.is_verified_seller = false;
    renderHarness();
    await click();
    expect(insertPayloads.current).toHaveLength(0);
    expect(toastMock.error.mock.calls.at(-1)?.[0]).toMatch(/verificad/i);
  });
});

describe("addProduct — o cliente não decide privilégios", () => {
  it("vendedor comum envia approved=false e o seu próprio seller_id", async () => {
    renderHarness({ ...NEW_PRODUCT, approved: true, sales: 9999, sellerId: "outra-pessoa" } as any);
    await click();
    const payload = insertPayloads.current[0];
    expect(payload.approved).toBe(false);
    expect(payload.seller_id).toBe("seller-uuid");
    expect(payload).not.toHaveProperty("sales");
    expect(payload).not.toHaveProperty("rating");
  });

  it("a aprovação exibida vem da resposta do banco, não do estado local", async () => {
    insertResult.current = { data: { id: 42, approved: false }, error: null };
    renderHarness();
    await click();
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    expect(toastMock.success.mock.calls.at(-1)?.[0]).toMatch(/aguardando aprovação/i);
  });

  it("admin recebe confirmação de publicação quando o banco aprova", async () => {
    authState.isAdmin = true;
    insertResult.current = { data: { id: 43, approved: true }, error: null };
    renderHarness();
    await click();
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    expect(toastMock.success.mock.calls.at(-1)?.[0]).toMatch(/publicado/i);
  });
});
