import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isAdmin: false,
  adminRoleResolved: false,
}));

const rpcResult = vi.hoisted(() => ({
  current: { data: { maintenance: false, message: "" } as Record<string, unknown> | null, error: null as unknown },
}));

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(async () => rpcResult.current),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));
vi.mock("@/components/AuthScreen", () => ({ default: () => <div>Autenticação administrativa</div> }));

// eslint-disable-next-line import/first
import MaintenanceGate from "@/components/MaintenanceGate";

function renderGate(pathname = "/") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <MaintenanceGate><div>Conteúdo protegido da vitrine</div></MaintenanceGate>
    </MemoryRouter>,
  );
}

describe("MaintenanceGate", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAdmin = false;
    authState.adminRoleResolved = false;
    rpcResult.current = { data: { maintenance: false, message: "" }, error: null };
    supabaseMock.rpc.mockClear();
  });

  it("mostra a manutenção para visitante e preserva uma entrada separada para o login administrativo", async () => {
    rpcResult.current = { data: { maintenance: true, message: "Atualização de segurança em andamento." }, error: null };
    renderGate();

    expect(await screen.findByRole("heading", { name: "Estamos preparando uma experiência melhor." })).toBeInTheDocument();
    expect(screen.getByText("Atualização de segurança em andamento.")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo protegido da vitrine")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Entrar como administrador" }));
    expect(screen.getByText("Autenticação administrativa")).toBeInTheDocument();
    expect(supabaseMock.rpc).toHaveBeenCalledWith("get_platform_status");
  });

  it("permite a aplicação somente após a confirmação de papel administrativo no servidor", async () => {
    authState.user = { id: "admin-confirmado" };
    authState.isAdmin = true;
    authState.adminRoleResolved = true;
    rpcResult.current = { data: { maintenance: true }, error: null };
    renderGate();

    await waitFor(() => expect(screen.getByText("Conteúdo protegido da vitrine")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Estamos preparando uma experiência melhor." })).not.toBeInTheDocument();
  });

  it("não derruba a vitrine quando a consulta pública de plataforma falha temporariamente", async () => {
    rpcResult.current = { data: null, error: { message: "indisponível" } };
    renderGate();

    await waitFor(() => expect(screen.getByText("Conteúdo protegido da vitrine")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Estamos preparando uma experiência melhor." })).not.toBeInTheDocument();
  });
});

describe("descoberta do modo de manutenção", () => {
  it("mantém um atalho administrativo explícito para a operação da plataforma", async () => {
    const source = await readFile(resolve(process.cwd(), "src/components/SideMenu.tsx"), "utf8");
    expect(source).toContain('label: "Operação e manutenção"');
    expect(source).toContain('to: "/admin?tab=config"');
  });
});
