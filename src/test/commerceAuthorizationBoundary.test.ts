import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = async (path: string) => readFile(join(process.cwd(), path), "utf8");

describe("fronteira de autorização comercial", () => {
  it("revoga RPCs financeiras legadas e serializa saque contra o saldo entregue", async () => {
    const migration = await source("supabase/migrations/20260826080100_harden_withdrawal_and_refund_rpcs.sql");
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, bigint)");
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.withdrawable_balance(uuid, bigint)");
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.seller_refund_order(bigint, text)");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("status = 'delivered'");
    expect(migration).toContain("Saldo disponível insuficiente para este saque");
  });

  it("reembolsa para a carteira apenas pelo servidor, com autorização e saldo ainda retido", async () => {
    const action = await source("supabase/functions/order-action/index.ts");
    const migration = await source("supabase/migrations/20260928183000_marketplace_hardening_wallet_notifications_verification.sql");
    expect(action).toContain("refund_purchase_to_wallet_server");
    expect(action).toContain("Apenas o vendedor do pedido ou um administrador pode realizar o reembolso.");
    expect(action).toContain("Apenas administradores podem executar a liberação automática manualmente.");
    expect(migration).toContain("IF _actor_id<>p.seller_id AND NOT is_admin");
    expect(migration).toContain("IF p.seller_released AND NOT is_admin");
    expect(migration).toContain("wallet:refund:");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.refund_purchase_to_wallet_server");
  });

  it("persiste mensagens de pedido somente pelo contrato de servidor autorizado", async () => {
    const action = await source("supabase/functions/order-action/index.ts");
    const store = await source("src/store/StoreContext.tsx");
    expect(action).toContain('"send_message"');
    expect(action).toContain("Apenas participantes do pedido podem enviar mensagens.");
    expect(action).toContain("containsExternalContact(cleanMessage)");
    expect(store).toContain('action: "send_message"');
    expect(store).not.toContain('.from("purchases").update({ messages:');
  });
});
