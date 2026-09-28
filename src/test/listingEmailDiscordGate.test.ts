import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFile(join(process.cwd(), path), "utf8");

describe("liberação de anúncios por e-mail e Discord", () => {
  it("remove SMS do gate e exige e-mail confirmado mais servidor do Discord no banco", async () => {
    const migration = await source("supabase/migrations/20260928223500_listing_email_discord_gate.sql");

    expect(migration).toContain("email_confirmed_at IS NOT NULL");
    expect(migration).toContain("discord_member_verified_at");
    expect(migration).toContain("DROP TRIGGER IF EXISTS enforce_listing_phone_verification_trg");
    expect(migration).toContain("CREATE TRIGGER enforce_listing_email_discord_trg");
    expect(migration).not.toContain("Verifique seu número por SMS antes de anunciar");
  });

  it("faz a checagem de servidor pelo Discord OAuth sem API de SMS", async () => {
    const inventory = await source("src/components/InventoryView.tsx");
    const auth = await source("src/components/AuthScreen.tsx");
    const callback = await source("src/pages/AuthCallback.tsx");
    const edge = await source("supabase/functions/discord-membership/index.ts");
    const config = await source("supabase/config.toml");

    expect(inventory).toContain("state.currentUser?.emailConfirmed");
    expect(inventory).toContain("state.currentUser?.discordMemberVerified");
    expect(inventory).toContain("getDiscordListingRedirectTo");
    expect(inventory).toContain('scopes: "identify email guilds"');
    expect(auth).toContain('scopes: "identify email guilds"');
    expect(callback).toContain('functions.invoke("discord-membership"');
    expect(edge).toContain("/users/@me/guilds");
    expect(edge).toContain("discord_member_verified_at");
    expect(edge).toContain("identity_data?.sub");
    expect(config).toContain("[functions.discord-membership]");
    expect(config).not.toContain("[functions.phone-verification]");
  });

  it("documentos continuam separados da permissão de anunciar", async () => {
    const profile = await source("src/pages/Perfil.tsx");
    const store = await source("src/store/StoreContext.tsx");

    expect(profile).toContain("Necessária para sacar dinheiro ou pagar com o saldo da carteira.");
    expect(profile).not.toContain("Confirme seu número por SMS");
    expect(profile).not.toContain("phoneVerified");
    expect(store).toContain("emailConfirmed");
    expect(store).toContain("discordMemberVerified");
    expect(store).not.toContain("phoneVerified");
  });
});
