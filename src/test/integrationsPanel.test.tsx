import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

// eslint-disable-next-line import/first
import IntegrationsPanel from "@/components/IntegrationsPanel";

describe("IntegrationsPanel — gateways seguros", () => {
  it("mostra métodos e instruções da MagnusPay sem criar campos para segredos", async () => {
    invoke.mockResolvedValue({
      data: {
        integrations: {
          magnuspay: { pixEnabled: true, pixFee: 0 },
          zennithpay: { pixEnabled: false, pixFee: 0.9 },
          vexopay: { pixEnabled: false, cryptoEnabled: false, pixFee: 1.2 },
          stripe: { cardEnabled: true, boletoEnabled: true, boletoExpiresAfterDays: 3 },
        },
        secretStatus: { MAGNUSPAY_API_KEY: true, STRIPE_SECRET_KEY: true, STRIPE_WEBHOOK_SECRET: true },
        discord: {
          enabled: true,
          providerCallback: "https://example.supabase.co/auth/v1/callback",
          appCallback: "https://zxmax.vercel.app/auth/callback",
        },
      },
      error: null,
    });

    render(<IntegrationsPanel />);

    await waitFor(() => expect(screen.getByText("Stripe · cartão e boleto")).toBeInTheDocument());
    expect(screen.getByText("MagnusPay PIX")).toBeInTheDocument();
    expect(screen.getAllByText(/MAGNUSPAY_API_KEY/).length).toBeGreaterThan(0);
    expect(screen.getByText("https://api.magnuspay.com.br")).toBeInTheDocument();
    expect(screen.getByLabelText("Oferecer cartão")).toBeChecked();
    expect(screen.getByLabelText("Oferecer boleto")).toBeChecked();
    expect(screen.getByLabelText("Validade do boleto (dias)")).toHaveValue(3);
    expect(screen.queryByPlaceholderText(/secret|api key|client secret/i)).not.toBeInTheDocument();
    expect(screen.getByText(/STRIPE_SECRET_KEY/)).toBeInTheDocument();
    expect(screen.getByText("Discord OAuth")).toBeInTheDocument();
    expect(screen.getByText("Provedor habilitado")).toBeInTheDocument();
    expect(screen.getByText("https://example.supabase.co/auth/v1/callback")).toBeInTheDocument();
  });
});
