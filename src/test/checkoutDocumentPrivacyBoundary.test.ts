import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("documento no checkout PIX", () => {
  it("não grava CPF/CNPJ pelo navegador e não usa perfil como fallback de cobrança", async () => {
    const productPage = await readFile(join(process.cwd(), "src/pages/Produto.tsx"), "utf8");
    const zennith = await readFile(join(process.cwd(), "supabase/functions/create-zennith-pix/index.ts"), "utf8");
    const vexo = await readFile(join(process.cwd(), "supabase/functions/create-evopay-pix/index.ts"), "utf8");

    expect(productPage).not.toContain('.from("profiles").update({ cpf }');
    expect(productPage).toContain("payerDocument: cpf || undefined");
    for (const source of [zennith, vexo]) {
      expect(source).toContain('String(body.payerDocument || "").replace(/\\D/g, "")');
      expect(source).not.toContain("display_name,cpf");
      expect(source).not.toContain("profile?.cpf");
      expect(source).toContain("Informe um CPF/CNPJ válido para gerar o PIX");
    }
  });
});
