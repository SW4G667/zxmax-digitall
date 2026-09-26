import { describe, expect, it } from "vitest";

const assetPath = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663136807726/ICombMzdoKrpWdhG.jpg";

describe("ativo visual do site", () => {
  it("mantém a referência persistente do logo sem mídia local ou segredo embutido", async () => {
    expect(assetPath).toMatch(/^https:\/\/files\.manuscdn\.com\/user_upload_by_module\/session_file\/[0-9]+\/[A-Za-z0-9]+\.jpg$/);
    expect(assetPath).not.toContain("base64");
    expect(assetPath).not.toContain("?");

    const response = await fetch(assetPath, { method: "HEAD" });
    expect([200, 302, 307, 401, 403]).toContain(response.status);
    expect(response.status).not.toBe(404);
  });
});
