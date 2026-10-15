/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com portas
 * OUT falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { listarFilaAction } from "./fila.actions";

const executeMock = jest.fn();

jest.mock("@/main/atendimento.factory", () => ({
  makeListarFila: async () => ({ execute: executeMock }),
}));

describe("listarFilaAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it("devolve a Fila do caso de uso para o Setor pedido", async () => {
    executeMock.mockResolvedValue(ok([{ atendimentoId: "at-1" }]));

    expect(await listarFilaAction("financeiro")).toEqual({
      ok: true,
      data: [{ atendimentoId: "at-1" }],
    });
    expect(executeMock).toHaveBeenCalledWith({ setor: "financeiro" });
  });

  it("rejeita Setor desconhecido sem chamar o caso de uso", async () => {
    const r = await listarFilaAction("ninguem");

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("repassa a negativa de Setor diferente do usuário", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Você só vê a Fila do seu Setor.")));

    const r = await listarFilaAction("rh");
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });
});
