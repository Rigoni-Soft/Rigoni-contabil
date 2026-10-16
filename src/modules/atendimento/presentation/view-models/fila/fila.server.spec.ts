import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { carregarFilaDoProprioSetor } from "./fila.server";

const executeMock = jest.fn();

jest.mock("server-only", () => ({}));
jest.mock("@/main/atendimento.factory", () => ({
  makeListarFila: async () => ({ execute: executeMock }),
}));

describe("carregarFilaDoProprioSetor", () => {
  beforeEach(() => executeMock.mockReset());

  it("devolve a Fila do Setor do próprio usuário", async () => {
    executeMock.mockResolvedValue(ok([{ atendimentoId: "at-1" }]));

    expect(await carregarFilaDoProprioSetor({ papel: "funcionario", setor: "financeiro" })).toEqual(
      { setor: "financeiro", dados: [{ atendimentoId: "at-1" }] },
    );
    expect(executeMock).toHaveBeenCalledWith({ setor: "financeiro" });
  });

  it("Admin não tem Setor: sem Fila e sem chamar o caso de uso", async () => {
    expect(
      await carregarFilaDoProprioSetor({ papel: "admin", setor: "administrativo" }),
    ).toBeNull();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("Setor desconhecido: sem Fila", async () => {
    expect(await carregarFilaDoProprioSetor({ papel: "funcionario", setor: "ninguem" })).toBeNull();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("sem permissão: a conversa segue sem a barra", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("sem acesso")));

    expect(
      await carregarFilaDoProprioSetor({ papel: "funcionario", setor: "financeiro" }),
    ).toBeNull();
  });
});
