import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("minimização de contatos em ferramentas administrativas", () => {
  it("mantém pedidos, estatísticas e exportações por identidade pública", async () => {
    const source = await readFile(join(process.cwd(), "src/components/AdminExtraPanels.tsx"), "utf8");
    const legacy = await readFile(join(process.cwd(), "src/components/AdminMorePanels.tsx"), "utf8");

    expect(source).not.toContain("p.sellerEmail || p.sellerId");
    expect(source).not.toContain("(p.buyerEmail || \"\").toLowerCase()");
    expect(source).not.toContain("(p.sellerEmail || \"\").toLowerCase()");
    expect(source).not.toContain("placeholder=\"Buscar por ID, e-mail ou ID público\"");
    expect(source).toContain("placeholder=\"Buscar por pedido ou ID público\"");
    expect(source).toContain('"comprador_id_publico", "vendedor_id_publico"');
    expect(source).toContain('["id_publico", "nome", "verificado"]');
    expect(source).not.toContain('"uuid", "id_publico", "nome", "email", "verificado"');
    expect(legacy).not.toContain("{p.buyerEmail} → {p.sellerEmail}");
    expect(legacy).not.toContain("{t.userEmail} · {t.status}");
    expect(legacy).not.toContain("<p className=\"font-bold\">{m.from}</p>");
    expect(legacy).toContain("Comprador {p.buyerPublicId");
    expect(legacy).toContain('m.from === active.userEmail ? "Solicitante" : "Equipe ZXMAX"');
  });
});
