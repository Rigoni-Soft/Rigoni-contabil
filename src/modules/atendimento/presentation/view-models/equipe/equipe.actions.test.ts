/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com o caso de
 * uso falso (testes.md, seção 3), sem tocar Supabase.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { listarAtendimentosDaEquipeAction } from "./equipe.actions";

const executeMock = jest.fn();

jest.mock("@/main/atendimento.factory", () => ({
  makeListarAtendimentosDaEquipe: async () => ({ execute: executeMock }),
}));

describe("listarAtendimentosDaEquipeAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it.each([[undefined], ["inexistente"], [42]])(
    "setor %p: VALIDATION_ERROR, sem chamar o caso de uso",
    async (setor) => {
      expect(await listarAtendimentosDaEquipeAction(setor)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      });
      expect(executeMock).not.toHaveBeenCalled();
    },
  );

  it("entrega o setor ao caso de uso e devolve a lista", async () => {
    executeMock.mockResolvedValue(ok([]));

    expect(await listarAtendimentosDaEquipeAction("tributario")).toEqual({ ok: true, data: [] });
    expect(executeMock).toHaveBeenCalledWith({ setor: "tributario" });
  });

  it("devolve o erro do caso de uso (Forbidden)", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

    expect(await listarAtendimentosDaEquipeAction("rh")).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });
});
