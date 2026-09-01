import { describe, expect, it, vi } from "vitest";
import { friendlyQuestionError, isSchemaMissing, QUESTIONS_UPDATE_MESSAGE } from "@/lib/questionErrors";

/**
 * O erro cru do PostgREST ("Could not find the function
 * public.ask_product_question(_body, _product_id) in the schema cache") nunca
 * pode chegar ao toast do usuário — era exatamente o que acontecia em
 * /produto/41 com o banco remoto desatualizado.
 */
describe("questionErrors", () => {
  it("reconhece função ausente do schema cache (PGRST202)", () => {
    const err = {
      code: "PGRST202",
      message: "Could not find the function public.ask_product_question(_body, _product_id) in the schema cache",
    };
    expect(isSchemaMissing(err)).toBe(true);
    expect(friendlyQuestionError(err, "ask")).toBe(QUESTIONS_UPDATE_MESSAGE);
    expect(friendlyQuestionError(err, "ask")).not.toMatch(/ask_product_question|schema cache/i);
  });

  it("reconhece tabela ausente (PGRST205) no SELECT da lista", () => {
    const err = { code: "PGRST205", message: "Could not find the table 'product_questions' in the schema cache" };
    expect(isSchemaMissing(err)).toBe(true);
    expect(friendlyQuestionError(err, "load")).toBe(QUESTIONS_UPDATE_MESSAGE);
  });

  it("repassa mensagens PT-BR seguras produzidas pelo próprio RPC", () => {
    expect(
      friendlyQuestionError({ code: "22023", message: "Não é permitido enviar contatos externos (WhatsApp, Discord, e-mail, links ou telefone)." }, "ask"),
    ).toMatch(/^Não é permitido enviar contatos externos/);
    expect(
      friendlyQuestionError({ code: "42501", message: "Faça login para enviar uma pergunta." }, "ask"),
    ).toBe("Faça login para enviar uma pergunta.");
    expect(
      friendlyQuestionError({ code: "42501", message: "Você não tem permissão para responder esta pergunta." }, "answer"),
    ).toBe("Você não tem permissão para responder esta pergunta.");
  });

  it("traduz falha de rede e sessão expirada", () => {
    expect(friendlyQuestionError({ message: "Failed to fetch" }, "ask")).toMatch(/Falha de conexão/);
    expect(friendlyQuestionError({ status: 401, message: "JWT invalid" }, "ask")).toMatch(/sessão expirou/i);
  });

  it("mensagem genérica e segura para erro desconhecido — sem vazar detalhes", () => {
    const msg = friendlyQuestionError({ message: "relation public.foo does not exist" }, "ask");
    expect(msg).not.toMatch(/relation|foo|does not exist/i);
    expect(msg.length).toBeGreaterThan(10);
  });

  it("o detalhe técnico completo vai para o console, nunca para a UI", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    friendlyQuestionError({ code: "XX000", message: "detalhe interno sigiloso" }, "answer");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
