import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateConfig = vi.hoisted(() => vi.fn());
const storeState = vi.hoisted(() => ({
  state: {
    config: { categories: ["Bots Discord", "Robux"] },
    products: [], purchases: [], tickets: [], userTags: [],
  },
  updateConfig,
}));

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(async (fn: string) => {
    if (fn === "get_admin_platform_settings") {
      return { data: { maintenance: false, message: "", minProductPrice: 2, minWithdraw: 5 }, error: null };
    }
    if (fn === "update_platform_categories") return { data: { categories: ["Bots Discord", "Serviços"] }, error: null };
    return { data: {}, error: null };
  }),
  functions: { invoke: vi.fn() },
}));

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/store/StoreContext", () => ({ useStore: () => storeState }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

// eslint-disable-next-line import/first
import { AdminCategoriesPanel, AdminPlatformPanel } from "@/components/AdminMorePanels";

describe("Painéis administrativos — RPCs de plataforma", () => {
  beforeEach(() => {
    supabaseMock.rpc.mockClear();
    updateConfig.mockClear();
    toastMock.error.mockClear();
    toastMock.success.mockClear();
  });

  it("salva categorias pela RPC auditada e atualiza o estado com a resposta do servidor", async () => {
    render(<AdminCategoriesPanel />);
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "Bots Discord\nServiços" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar categorias" }));

    await waitFor(() => expect(supabaseMock.rpc).toHaveBeenCalledWith("update_platform_categories", {
      _categories: ["Bots Discord", "Serviços"],
    }));
    expect(updateConfig).toHaveBeenCalledWith({ categories: ["Bots Discord", "Serviços"] });
  });

  it("carrega e atualiza manutenção e limites pelas RPCs administrativas", async () => {
    render(<AdminPlatformPanel />);
    await waitFor(() => expect(supabaseMock.rpc).toHaveBeenCalledWith("get_admin_platform_settings"));

    fireEvent.click(screen.getByLabelText("Modo manutenção"));
    fireEvent.change(screen.getByPlaceholderText("Mensagem de manutenção"), { target: { value: "Atualização curta" } });
    const numericInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numericInputs[0], { target: { value: "3" } });
    fireEvent.change(numericInputs[1], { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(supabaseMock.rpc).toHaveBeenCalledWith("update_platform_settings", {
      _maintenance: true,
      _message: "Atualização curta",
      _min_product_price: 3,
      _min_withdraw: 8,
    }));
  });
});
