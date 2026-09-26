import { describe, expect, it } from "vitest";
import { getAppUrl, isGeneratedVercelPreviewHost, normalizeAppOrigin } from "@/lib/appUrl";

describe("app URL helpers", () => {
  it("mantém callbacks no domínio atual ou customizado", () => {
    expect(getAppUrl("/auth/callback", "https://zxmax.example.com")).toBe("https://zxmax.example.com/auth/callback");
    expect(getAppUrl("/reset-password", "https://loja.exemplo.com/")).toBe("https://loja.exemplo.com/reset-password");
  });

  it("normaliza origin sem fixar domínio da Vercel", () => {
    expect(normalizeAppOrigin("https://loja.exemplo.com/path")).toBe("https://loja.exemplo.com");
  });

  it("diferencia preview gerado da URL estável", () => {
    expect(isGeneratedVercelPreviewHost("zxmax-jczc2v8t4-time-projects.vercel.app")).toBe(true);
    expect(isGeneratedVercelPreviewHost("zxmax-git-feature-time.vercel.app")).toBe(true);
    expect(isGeneratedVercelPreviewHost("zxmax.vercel.app")).toBe(false);
    expect(isGeneratedVercelPreviewHost("loja.exemplo.com")).toBe(false);
  });
});
