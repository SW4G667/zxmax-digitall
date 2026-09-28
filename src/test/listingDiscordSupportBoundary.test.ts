import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = async (path: string) => readFile(join(process.cwd(), path), "utf8");

describe("acesso de vendedor e central de suporte", () => {
  it("exige somente e-mail confirmado e participação no Discord para anunciar", async () => {
    const inventory = await source("src/components/InventoryView.tsx");
    const gate = await source("supabase/migrations/20260928233000_listing_discord_current_guild_and_support.sql");

    expect(inventory).toContain("emailConfirmed");
    expect(inventory).toContain("discordMemberVerified");
    expect(inventory).toContain("Confirme o e-mail e entre no Discord");
    expect(inventory).toContain("Não precisa cadastrar número de telefone");
    expect(inventory).toContain("linkIdentity");
    expect(inventory).not.toContain("phoneVerified");
    expect(gate).toContain("email_confirmed_at");
    expect(gate).toContain("discord_member_verified_at");
    expect(gate).toContain("discord_guild_id");
    expect(gate).toContain("discordGuildId");
    expect(gate).not.toContain("phone_verified_at");
  });

  it("mantém o convite oficial configurável e separado do suporte externo", async () => {
    const branding = await source("src/context/SiteBrandingContext.tsx");
    const admin = await source("src/pages/AdminBranding.tsx");
    const siteConfig = await source("supabase/functions/site-config/index.ts");
    const membership = await source("supabase/functions/discord-membership/index.ts");

    expect(branding).toContain("discordInviteUrl");
    expect(admin).toContain("Convite oficial do Discord");
    expect(admin).toContain("Link externo de suporte");
    expect(siteConfig).toContain("safeDiscordInvite");
    expect(siteConfig).toContain("resolveDiscordGuild");
    expect(siteConfig).toContain("discordGuildId");
    expect(membership).toContain("discordInviteUrl");
    expect(membership).toContain("discordGuildId");
  });

  it("persiste chamados e respostas e envia notificações de suporte", async () => {
    const store = await source("src/store/StoreContext.tsx");
    const support = await source("src/components/SupportView.tsx");
    const notifications = await source("src/components/NotificationBell.tsx");
    const migration = await source("supabase/migrations/20260928233000_listing_discord_current_guild_and_support.sql");

    expect(store).toContain('.from("support_tickets")');
    expect(store).toContain('rpc("reply_support_ticket"');
    expect(store).toContain('rpc("close_support_ticket"');
    expect(support).toContain("Central de ajuda");
    expect(support).toContain("Dúvidas rápidas");
    expect(support).toContain('searchParams.get("ticket")');
    expect(notifications).toContain('type === "support"');
    expect(migration).toContain("notify_new_support_ticket");
    expect(migration).toContain("Nova resposta do suporte");
    expect(migration).toContain("Usuário respondeu ao suporte");
  });
});
