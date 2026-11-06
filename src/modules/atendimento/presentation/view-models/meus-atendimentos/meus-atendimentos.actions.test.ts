/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com portas
 * OUT falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { listarMeusAtendimentosAction } from "./meus-atendimentos.actions";

const executeMock = jest.fn();

jest.mock("@/main/atendimento.factory", () => ({
  makeListarMeusAtendimentos: async () => ({ execute: executeMock }),
}));

describe("listarMeusAtendimentosAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it("devolve os Atendimentos do caso de uso", async () => {
    const atendimentos = [{ atendimentoId: "at-1" }];
    executeMock.mockResolvedValue(ok(atendimentos));

    expect(await listarMeusAtendimentosAction()).toEqual({ ok: true, data: atendimentos });
  });

  it("repassa a negativa de quem não está logado", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Faça login.")));

    const r = await listarMeusAtendimentosAction();
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });
});
