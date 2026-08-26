import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "@/components/ErrorBoundary";

function BrokenProduct() {
  throw new Error("BUYER_FEE is not defined");
}

describe("ErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("mostra recuperação segura sem vazar detalhes técnicos", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <BrokenProduct />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "Não foi possível abrir esta página." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar à vitrine" })).toBeInTheDocument();
    expect(screen.queryByText("BUYER_FEE is not defined")).not.toBeInTheDocument();
  });
});
