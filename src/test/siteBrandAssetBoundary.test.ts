import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ativos visuais do site", () => {
  it("não depende de branding externo fixo e permite assets administráveis", async () => {
    const html = await readFile(join(process.cwd(), "index.html"), "utf8");
    const branding = await readFile(join(process.cwd(), "src/context/SiteBrandingContext.tsx"), "utf8");
    const admin = await readFile(join(process.cwd(), "src/pages/AdminBranding.tsx"), "utf8");

    expect(html).not.toContain("manuscdn");
    expect(html).not.toContain("@Lovable");
    expect(html).toContain('site-config?asset=favicon');
    expect(branding).toContain("heroBannerUrl");
    expect(branding).toContain("socialPreviewUrl");
    expect(branding).toContain("robuxBannerUrl");
    expect(admin).toContain("Imagem ao compartilhar o link");
    expect(branding).toContain('meta[property="og:image"]');
    expect(branding).toContain("branding.socialPreviewUrl");
    expect(html).toContain("site-config?asset=socialPreview");
    expect(admin).toContain("Banner de Robux");
    expect(admin).toContain("Capa principal");
  });
});
