import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("página de rota inexistente", () => {
  it("oferece recuperação segura e não despeja detalhes técnicos na interface", async () => {
    const page = await readFile(join(process.cwd(), "src/pages/NotFound.tsx"), "utf8");

    expect(page).toContain("A navegação não alterou sua conta, pedidos ou pagamentos.");
    expect(page).toContain('to="/loja"');
    expect(page).toContain('to="/suporte"');
    expect(page).toContain("navigate(-1)");
    expect(page).not.toContain("console.error");
    expect(page).not.toContain("Error:");
  });
});
