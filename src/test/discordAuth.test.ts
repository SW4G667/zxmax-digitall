import { describe, it, expect, beforeEach } from "vitest";
import {
  buildDiscordAuthorizeUrl,
  rememberRedirectUri,
  consumeRememberedRedirectUri,
  DISCORD_REDIRECT_STORAGE_KEY,
} from "@/lib/discordAuth";

describe("buildDiscordAuthorizeUrl", () => {
  it("usa o Client ID salvo no painel (nunca um ID fixo)", () => {
    const url = buildDiscordAuthorizeUrl({
      clientId: "999888777",
      redirectUri: "https://zxmax.vercel.app/",
      scopes: "identify email",
    });
    expect(url).toContain("client_id=999888777");
    expect(url.startsWith("https://discord.com/oauth2/authorize?")).toBe(true);
  });

  it("codifica redirect_uri e scopes corretamente", () => {
    const url = buildDiscordAuthorizeUrl({
      clientId: "123",
      redirectUri: "https://zxmax.vercel.app/",
      scopes: "identify email",
    });
    const params = new URL(url).searchParams;
    expect(params.get("redirect_uri")).toBe("https://zxmax.vercel.app/");
    expect(params.get("scope")).toBe("identify email");
    expect(params.get("response_type")).toBe("code");
  });

  it("mantém a redirect_uri idêntica entre autorização e troca de código", () => {
    const redirectUri = "https://zxmax-digitall.vercel.app/";
    const url = buildDiscordAuthorizeUrl({ clientId: "123", redirectUri, scopes: "identify" });
    const fromUrl = new URL(url).searchParams.get("redirect_uri");
    expect(fromUrl).toBe(redirectUri);
  });
});

describe("redirect_uri lembrada", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("guarda e consome a redirect_uri exata uma única vez", () => {
    rememberRedirectUri("https://zxmax.vercel.app/");
    expect(sessionStorage.getItem(DISCORD_REDIRECT_STORAGE_KEY)).toBe("https://zxmax.vercel.app/");
    expect(consumeRememberedRedirectUri()).toBe("https://zxmax.vercel.app/");
    expect(consumeRememberedRedirectUri()).toBeNull();
  });

  it("retorna null quando nada foi salvo", () => {
    expect(consumeRememberedRedirectUri()).toBeNull();
  });
});
