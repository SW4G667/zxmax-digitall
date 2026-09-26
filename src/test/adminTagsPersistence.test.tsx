import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const createUserTag = vi.fn();
const assignUserTag = vi.fn();
const refreshUserTags = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

vi.mock("@/store/StoreContext", () => ({
  useStore: () => ({
    state: { userTags: [{ id: "2fd88e31-3a0b-41b2-9718-1c4b61b08f23", name: "Vendedor destaque", color: "#168cff" }] },
    createUserTag,
    deleteUserTag: vi.fn(),
    assignUserTag,
    refreshUserTags,
  }),
}));

// eslint-disable-next-line import/first
import { AdminTagsPanel } from "@/components/AdminMorePanels";

describe("AdminTagsPanel — persistência e privacidade", () => {
  it("atribui uma tag por ID público, sem solicitar e-mail", async () => {
    createUserTag.mockResolvedValue(true);
    assignUserTag.mockResolvedValue(true);
    render(<AdminTagsPanel />);

    expect(screen.getByPlaceholderText("ID público do usuário")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/e-mail/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("ID público do usuário"), { target: { value: "100042" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2fd88e31-3a0b-41b2-9718-1c4b61b08f23" } });
    fireEvent.click(screen.getByRole("button", { name: "Atribuir" }));

    await waitFor(() => expect(assignUserTag).toHaveBeenCalledWith("100042", "2fd88e31-3a0b-41b2-9718-1c4b61b08f23"));
  });
});
