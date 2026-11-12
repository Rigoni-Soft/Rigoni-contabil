import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { AtorSessaoDto } from "@/modules/rh/application/ports/out/sessao.provider";
import { IniciarCartaoDoPonto } from "@/modules/rh/application/use-cases/iniciar-cartao-do-ponto.use-case";
import { ok } from "@/shared/kernel/result";

const FUNC: AtorSessaoDto = { id: "func", papel: "funcionario", setor: "rh" };
const LIDER: AtorSessaoDto = { id: "lider", papel: "lider_setor", setor: "rh" };
// 20/11/2026: mês corrente.
const AGORA = new Date("2026-11-20T15:00:00Z");

function montar(ator: AtorSessaoDto | null) {
  const repositorio = {
    buscarCliente: jest.fn(async () =>
      ok({ cnpj: "11444777000161", empresa: "Teste Ltda", responsavelId: "func" }),
    ),
    buscarClienteDoEmpregado: jest.fn(async () => ok("c1")),
    iniciarCartao: jest.fn(async () => ok(undefined)),
  } as unknown as jest.Mocked<FolhaDePontoRepository>;
  const auditoria = { registrar: jest.fn(async () => undefined) };
  const caso = new IniciarCartaoDoPonto(
    { usuarioAtual: async () => ator },
    repositorio,
    auditoria,
    { agora: () => AGORA },
  );
  return { caso, repositorio, auditoria };
}

describe("IniciarCartaoDoPonto", () => {
  it("o Responsável marca o cartão do mês como iniciado (primeiro dia do mês)", async () => {
    const { caso, repositorio } = montar(FUNC);

    const r = await caso.execute({ empregadoId: "e1", competencia: "2026-11" });

    expect(r.ok).toBe(true);
    expect(repositorio.iniciarCartao).toHaveBeenCalledWith("e1", "2026-11-01");
  });

  it("o Líder só lê: recusa e audita a tentativa", async () => {
    const { caso, repositorio, auditoria } = montar(LIDER);

    const r = await caso.execute({ empregadoId: "e1", competencia: "2026-11" });

    expect(r.ok).toBe(false);
    expect(repositorio.iniciarCartao).not.toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "rh.ponto.iniciar-cartao", resultado: "falha" }),
    );
  });

  it("mês que ainda não começou ou competência inválida é recusado", async () => {
    const { caso, repositorio } = montar(FUNC);

    expect((await caso.execute({ empregadoId: "e1", competencia: "2027-01" })).ok).toBe(false);
    expect((await caso.execute({ empregadoId: "e1", competencia: "2026-13" })).ok).toBe(false);
    expect(repositorio.iniciarCartao).not.toHaveBeenCalled();
  });
});
