import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("fronteira de verificação administrativa", () => {
  it("centraliza dados sensíveis e mutações de verificação na função administrativa", async () => {
    const adminView = await readFile(join(process.cwd(), "src/components/AdminView.tsx"), "utf8");
    const adminVerify = await readFile(join(process.cwd(), "supabase/functions/admin-verify/index.ts"), "utf8");
    const store = await readFile(join(process.cwd(), "src/store/StoreContext.tsx"), "utf8");
    const config = await readFile(join(process.cwd(), "supabase/config.toml"), "utf8");

    expect(adminView).toContain('action: "get_verifications"');
    expect(adminView).not.toContain('.from("profiles")');
    expect(adminView).not.toContain('.from("seller_documents")');
    expect(adminView).not.toContain('.from("webhook_logs")');
    expect(adminView).not.toContain('.storage.from("documents")');
    expect(adminView).not.toContain("reviewSellerDocument");
    expect(adminView).not.toContain('.from("products").update');
    expect(adminView).not.toContain("JSON.stringify(log.payload");
    expect(adminView).toContain('action: approved ? "verify_user" : "reject_user"');
    expect(adminView).toContain('action: "approve_all_products"');
    expect(adminView).toContain('action: "get_webhook_logs"');
    expect(adminView).toContain("documentId: doc.id");
    expect(adminVerify).toContain('action === "get_verifications"');
    expect(adminVerify).toContain('action === "get_webhook_logs"');
    expect(adminVerify).toContain('action === "ban_user"');
    expect(adminVerify).toContain('action === "unban_user"');
    expect(adminVerify).toContain('action: "user.banned"');
    expect(adminVerify).toContain('action: "user.unbanned"');
    expect(adminVerify).toContain('if (!roleData) throw new Error("Acesso negado: só admin")');
    expect(store).not.toContain('profileSource = isAdmin ? "profiles" : "profiles_public"');
    expect(store).not.toContain('.from("seller_documents").select');
    expect(store).not.toContain("const reviewSellerDocument");
    expect(store).not.toContain('update({ is_verified_seller: true, verification_status: "approved"');
    expect(store).not.toContain("Fallback direct (requires RLS fix migration)");
    expect(store).not.toContain('.from("bans").insert');
    expect(store).not.toContain('.from("bans").update');
    expect(store).toContain('action: "ban_user"');
    expect(store).toContain('action: "unban_user"');
    expect(config).toMatch(/\[functions\.admin-verify\]\s+verify_jwt = true/);
  });
});
