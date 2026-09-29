import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("PIX amount limit", () => {
  it("blocks an oversized primary PIX before creating a doomed order", async () => {
    const checkout = await readFile("src/pages/Produto.tsx", "utf8");
    const purchase = await readFile("supabase/functions/create-purchase/index.ts", "utf8");
    const pix = await readFile("supabase/functions/create-magnuspay-pix/index.ts", "utf8");
    expect(checkout).toContain("pixAboveLimit");
    expect(checkout).toContain("R$ 5.000,00");
    expect(purchase).toContain('code: "pix_amount_limit"');
    expect(pix).toContain('code: "pix_amount_limit"');
  });
});
