import { describe, expect, it } from "vitest";
import { getDiscordRedirectTo } from "@/lib/discordAuth";

describe("getDiscordRedirectTo", () => {
  it("usa uma rota de callback estável no mesmo domínio", () => {
    expect(getDiscordRedirectTo("https://zxmax.vercel.app")).toBe("https://zxmax.vercel.app/auth/callback");
  });

  it("não contém Client ID, secret, código ou token", () => {
    const redirect = getDiscordRedirectTo("https://preview.example.com/");
    expect(redirect).toBe("https://preview.example.com/auth/callback");
    expect(redirect).not.toMatch(/client|secret|token|code/i);
  });
});
