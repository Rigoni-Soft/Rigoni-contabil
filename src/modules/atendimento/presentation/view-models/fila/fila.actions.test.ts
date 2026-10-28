/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com portas
 * OUT falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { ConflictError } from "@/shared/errors/conflict.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { assumirAtendimentoAction, listarFilaAction } from "./fila.actions";

const executeMock = jest.fn();
const assumirMock = jest.fn();

jest.mock("@/main/atendimento.factory", () => ({
  makeListarFila: async () => ({ execute: executeMock }),
  makeAssumirAtendimento: async () => ({ execute: assumirMock }),
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

describe("assumirAtendimentoAction (integração)", () => {
  const ID = "9f1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d";
  beforeEach(() => assumirMock.mockReset());

  it("assume o Atendimento pedido", async () => {
    assumirMock.mockResolvedValue(ok({ atendimentoId: ID }));

    expect(await assumirAtendimentoAction(ID)).toEqual({ ok: true, data: { atendimentoId: ID } });
    expect(assumirMock).toHaveBeenCalledWith({ atendimentoId: ID });
  });

  it("repassa 'já assumido' de quem perdeu a corrida", async () => {
    assumirMock.mockResolvedValue(err(new ConflictError("Atendimento já assumido.")));

    const r = await assumirAtendimentoAction(ID);
    expect(!r.ok && r.error.code).toBe("CONFLICT");
  });

  it("rejeita id inválido sem chamar o caso de uso", async () => {
    const r = await assumirAtendimentoAction("1");

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(assumirMock).not.toHaveBeenCalled();
  });
});
