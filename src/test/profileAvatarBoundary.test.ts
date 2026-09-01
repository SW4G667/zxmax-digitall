import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Perfil — avatar e identidade pública", () => {
  it("mantém o ID público permanente e permite somente imagem limitada para a foto pública", async () => {
    const page = await readFile(join(process.cwd(), "src/pages/Perfil.tsx"), "utf8");

    expect(page).toContain("ID público permanente:");
    expect(page).toContain('const AVATAR_MAX_BYTES = 2 * 1024 * 1024');
    expect(page).toContain('image/jpeg');
    expect(page).toContain('image/png');
    expect(page).toContain('image/webp');
    expect(page).toContain('.from("avatars")');
    expect(page).toContain('`${profile.public_id}/perfil.${avatarExtension(avatarFile.type)}`');
  });

  it("não usa e-mail na seed de avatar nem no caminho público de upload", async () => {
    const page = await readFile(join(process.cwd(), "src/pages/Perfil.tsx"), "utf8");
    const store = await readFile(join(process.cwd(), "src/store/StoreContext.tsx"), "utf8");

    expect(page).toContain('`zxmax-${profile?.public_id || "perfil"}`');
    expect(page).not.toContain("NEW.email::bytea");
    expect(page).not.toContain("profile.email");
    expect(store).toContain('`zxmax-${userPublicId}`');
    expect(store).not.toContain('svg?seed=${encodeURIComponent(profile?.display_name || authUser.email || "")}');
  });
});
