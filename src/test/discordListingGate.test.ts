import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("gate de anúncio pelo Discord", () => {
  it("exige OAuth atual para cada novo anúncio e revalida no envio", async () => {
    const inventory = await readFile(join(process.cwd(), "src/components/InventoryView.tsx"), "utf8");
    expect(inventory).toContain("setDiscordGateOpen(true);");
    expect(inventory).toContain("verifyDiscordMembershipNow");
    expect(inventory).toContain('body: { action: "verify", providerToken }');
    expect(inventory).toContain("editingId === null && !(await verifyDiscordMembershipNow())");
    expect(inventory).toContain("Obrigatória agora");
    expect(inventory).toContain("Autorizar e verificar no Discord");
  });

  it("revoga prova antiga se o usuário não estiver mais no servidor", async () => {
    const fn = await readFile(join(process.cwd(), "supabase/functions/discord-membership/index.ts"), "utf8");
    expect(fn).toContain("Date.now() - verifiedAt <= 2 * 60 * 1000");
    expect(fn).toContain("discord_member_verified_at: null");
    expect(fn).toContain("discordGuildName: guildName");
  });
});
