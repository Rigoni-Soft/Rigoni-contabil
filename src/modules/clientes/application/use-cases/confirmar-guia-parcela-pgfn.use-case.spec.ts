import type { GuiaParcelaPgfnRepository } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { err, ok } from "@/shared/kernel/result";

import { ConfirmarGuiaParcelaPgfn } from "./confirmar-guia-parcela-pgfn.use-case";

const INPUT = { parcelamentoId: "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2", competencia: "202610" };

function montar(ator: { id: string; papel: string; setor: string } | null) {
  const confirmar = jest.fn().mockResolvedValue(ok(undefined));
  const sessao: SessaoPort = { usuarioAtual: async () => ator };
  const guias = { confirmar } as unknown as GuiaParcelaPgfnRepository;
  return { confirmar, caso: new ConfirmarGuiaParcelaPgfn(sessao, guias) };
}

describe("ConfirmarGuiaParcelaPgfn", () => {
  it.each([
    ["funcionario", "simples_nacional"],
    ["lider_setor", "simples_nacional"],
    ["admin", "administrativo"],
  ])("%s confirma a guia pela chave (Parcelamento, competência)", async (papel, setor) => {
    const { caso, confirmar } = montar({ id: "u-1", papel, setor });

    expect((await caso.execute(INPUT)).ok).toBe(true);
    expect(confirmar).toHaveBeenCalledWith(INPUT.parcelamentoId, INPUT.competencia);
  });

  it.each([
    ["Funcionário de outro Setor", { id: "u-2", papel: "funcionario", setor: "financeiro" }],
    ["sem sessão", null],
  ])("%s não confirma", async (_nome, ator) => {
    const { caso, confirmar } = montar(ator);

    expect(await caso.execute(INPUT)).toMatchObject({
      ok: false,
      error: expect.any(ForbiddenError),
    });
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("devolve o erro do repositório (guia inexistente)", async () => {
    const { caso, confirmar } = montar({ id: "u-1", papel: "admin", setor: "administrativo" });
    confirmar.mockResolvedValue(err(new NotFoundError("Não encontramos esta guia.")));

    expect(await caso.execute(INPUT)).toMatchObject({
      ok: false,
      error: expect.any(NotFoundError),
    });
  });
});
