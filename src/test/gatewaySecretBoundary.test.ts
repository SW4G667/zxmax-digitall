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
});
