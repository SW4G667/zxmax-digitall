import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = async (path: string) => readFile(join(process.cwd(), path), "utf8");

describe("gate de anúncio por e-mail + Discord", () => {
  it("não exige telefone e bloqueia anúncio sem e-mail confirmado ou servidor oficial", async () => {
    const [inventory, store, migration] = await Promise.all([
      source("src/components/InventoryView.tsx"),
      source("src/store/StoreContext.tsx"),
      source("supabase/migrations/20260928232000_listing_email_discord_only.sql"),
    ]);

    expect(inventory).toContain("Confirme o e-mail da sua conta antes de anunciar.");
    expect(inventory).toContain("discordMemberVerified");
    expect(inventory).toContain("Não precisa cadastrar número de telefone.");
    expect(store).toContain("Confirme seu e-mail antes de anunciar.");
    expect(store).toContain("Entre no servidor do Discord e verifique sua conta antes de anunciar.");

    expect(migration).toContain("email_confirmed_at IS NOT NULL");
    expect(migration).toContain("discord_member_verified_at");
    expect(migration).toContain("discordGuildId");
    expect(migration).toContain("DROP TRIGGER IF EXISTS enforce_listing_phone_verification_trg");
    expect(migration).not.toContain("phone_verified_at");
  });

  it("usa apenas o convite configurado pelo admin e valida o servidor do Discord", async () => {
    const [branding, config, membership, header] = await Promise.all([
      source("src/pages/AdminBranding.tsx"),
      source("supabase/functions/site-config/index.ts"),
      source("supabase/functions/discord-membership/index.ts"),
      source("src/components/Header.tsx"),
    ]);

    expect(branding).toContain("Convite oficial do Discord");
    expect(branding).toContain("Servidor detectado");
    expect(config).toContain("safeDiscordInvite");
    expect(config).toContain("discordGuildName");
    expect(config).toContain("Não consegui validar esse convite no Discord");
    expect(membership).toContain('current?.discordInviteUrl || ""');
    expect(membership).not.toContain('https://discord.gg/zxmax');
    expect(header).toContain("branding.discordInviteUrl || state.config.discordLink");
  });

  it("central de ajuda explica requisitos e oferece busca e filtros sem prometer SLA", async () => {
    const support = await source("src/components/SupportView.tsx");
    expect(support).toContain("E-mail confirmado + servidor oficial do Discord");
    expect(support).toContain("Não existe exigência de telefone para publicar anúncio.");
    expect(support).toContain('placeholder="Buscar ajuda..."');
    expect(support).toContain("Finalizados");
    expect(support).toContain("Problema com pedido");
    expect(support).not.toMatch(/resposta em \d+ minutos|24 horas|atendimento 24\/7/i);
  });
});
