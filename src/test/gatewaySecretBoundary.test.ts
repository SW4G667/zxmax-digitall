import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = async (path: string) => readFile(join(process.cwd(), path), "utf8");

describe("fronteira de secrets dos gateways", () => {
  it("usa somente secret de ambiente no saque ZennithPay e exige JWT na plataforma", async () => {
    const [withdraw, config] = await Promise.all([
      source("supabase/functions/zennith-withdraw/index.ts"),
      source("supabase/config.toml"),
    ]);
    expect(withdraw).toContain('Deno.env.get("ZENNITH_API_KEY")');
    expect(withdraw).not.toContain("cfg.apiKey");
    expect(config).toMatch(/\[functions\.zennith-withdraw\]\s*verify_jwt = true/);
  });

  it("mantém a rota EvoPay de saque explicitamente desativada", async () => {
    const evopay = await source("supabase/functions/evopay-withdraw/index.ts");
    expect(evopay).toContain("status: 410");
    expect(evopay).not.toContain("EVOPAY_API_KEY");
    expect(evopay).not.toContain("app_settings");
  });

  it("permite retry da Stripe quando o processamento interno do webhook falha", async () => {
    const webhook = await source("supabase/functions/stripe-webhook/index.ts");
    expect(webhook).toContain('return json({ error: "Temporary webhook processing failure" }, 500)');
    expect(webhook).toContain("apply_verified_payment");
    expect(webhook).toContain('return json({ error: "Unauthorized" }, 401)');
  });

  it("mantém o contrato VexoPay somente em secrets de ambiente e endpoints documentados", async () => {
    const [crypto, status, purchase, webhook] = await Promise.all([
      source("supabase/functions/create-vexopay-crypto/index.ts"),
      source("supabase/functions/check-evopay-status/index.ts"),
      source("supabase/functions/create-purchase/index.ts"),
      source("supabase/functions/vexopay-webhook/index.ts"),
    ]);
    expect(crypto).toContain('Deno.env.get("VEXOPAY_CLIENT_ID")');
    expect(crypto).not.toContain("setting?.value?.clientId");
    expect(crypto).not.toContain("setting?.value?.clientSecret");
    expect(crypto).toContain('`${baseUrl}/gateway/crypto-create`');
    expect(crypto).not.toContain('"/crypto-create"');
    expect(crypto).toContain("amount < 20 || amount > 3000");
    expect(status).not.toContain("EVOPAY_API_KEY");
    expect(status).not.toContain("v.clientId");
    expect(status).toContain("payment_provider");
    expect(purchase).toContain("vexopayReady");
    expect(webhook).toContain("/gateway/pix-status?transactionId=");
    expect(webhook).toContain("/gateway/crypto-status?id=");
    expect(webhook).toContain("apply_verified_payment");
    expect(webhook).toContain('return json({ error: "Missing transaction id" }, 400)');
    expect(webhook).toContain('return json({ error: "Unsupported webhook event" }, 400)');
    expect(webhook).toContain('new Set(["payment.completed", "payment.failed", "payment.expired"])');
  });
});
