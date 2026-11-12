import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { AtorSessaoDto } from "@/modules/rh/application/ports/out/sessao.provider";
import {
  CadastrarEmpregado,
  CorrigirEmpregado,
  DefinirEmpregadoAtivo,
  DefinirPadraoComissionados,
  DefinirSemMovimento,
} from "@/modules/rh/application/use-cases/gerir-quadro-de-funcionarios.use-case";
import { SalvarDiaDoPonto } from "@/modules/rh/application/use-cases/salvar-dia-do-ponto.use-case";
import { ok } from "@/shared/kernel/result";

const FUNC: AtorSessaoDto = { id: "func", papel: "funcionario", setor: "rh" };
const OUTRO: AtorSessaoDto = { id: "outro", papel: "funcionario", setor: "rh" };
const LIDER: AtorSessaoDto = { id: "lider", papel: "lider_setor", setor: "rh" };
const JORNADA = [0, 525, 525, 525, 525, 525, 240];

function montar(ator: AtorSessaoDto | null, padrao = false) {
  const repositorio = {
    buscarCliente: jest.fn(async () => ok({ cnpj: "11444777000161", responsavelId: "func" })),
    buscarClienteDoEmpregado: jest.fn(async () => ok("c1")),
    buscarPadraoComissionados: jest.fn(async () => ok(padrao)),
    definirPadraoComissionados: jest.fn(async () => ok(undefined)),
    cadastrarEmpregado: jest.fn(async () => ok(undefined)),
    corrigirEmpregado: jest.fn(async () => ok(undefined)),
    definirAtivo: jest.fn(async () => ok(undefined)),
    definirSemMovimento: jest.fn(async () => ok(undefined)),
    salvarDia: jest.fn(async () => ok(undefined)),
  } as unknown as jest.Mocked<FolhaDePontoRepository>;
  const sessao = { usuarioAtual: async () => ator };
  const auditoria = { registrar: jest.fn(async () => undefined) };
  const relogio = { agora: () => new Date("2026-11-20T15:00:00Z") };
  return {
    repositorio,
    auditoria,
    cadastrar: new CadastrarEmpregado(sessao, repositorio, auditoria),
    corrigir: new CorrigirEmpregado(sessao, repositorio, auditoria),
    ativo: new DefinirEmpregadoAtivo(sessao, repositorio, auditoria),
    semMovimento: new DefinirSemMovimento(sessao, repositorio, auditoria, relogio),
    padrao: new DefinirPadraoComissionados(sessao, repositorio, auditoria),
    salvarDia: new SalvarDiaDoPonto(sessao, repositorio, auditoria, relogio),
  };
}

describe("quadro de funcionários e cartão: quem escreve", () => {
  it.each([
    ["o Líder", LIDER],
    ["outro Funcionário do RH", OUTRO],
  ])("%s não escreve e a tentativa é auditada", async (_nome, ator) => {
    const t = montar(ator);
    const r = await t.cadastrar.execute({ clienteId: "c1", nome: "Ana", jornada: JORNADA });
    expect(r.ok).toBe(false);
    expect(t.repositorio.cadastrarEmpregado).not.toHaveBeenCalled();
    expect(t.auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "rh.empregado.cadastrar", resultado: "falha" }),
    );
  });

  it("sem sessão, recusa", async () => {
    const r = await montar(null).cadastrar.execute({
      clienteId: "c1",
      nome: "Ana",
      jornada: JORNADA,
    });
    expect(r.ok).toBe(false);
  });

  it("o Responsável cadastra, e a marca nasce do padrão do Cliente", async () => {
    const t = montar(FUNC, true);
    const r = await t.cadastrar.execute({ clienteId: "c1", nome: " Ana ", jornada: JORNADA });
    expect(r.ok).toBe(true);
    expect(t.repositorio.cadastrarEmpregado).toHaveBeenCalledWith("c1", {
      nome: "Ana",
      jornada: JORNADA,
      comissionado: true,
    });
  });

  it("a marca informada vence o padrão (exceção por empregado)", async () => {
    const t = montar(FUNC, true);
    await t.cadastrar.execute({
      clienteId: "c1",
      nome: "Ana",
      jornada: JORNADA,
      comissionado: false,
    });
    expect(t.repositorio.cadastrarEmpregado).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ comissionado: false }),
    );
  });

  it("recusa nome vazio e Jornada fora de 7 dias ou de 0 a 24h", async () => {
    const t = montar(FUNC);
    expect((await t.cadastrar.execute({ clienteId: "c1", nome: "  ", jornada: JORNADA })).ok).toBe(
      false,
    );
    expect((await t.cadastrar.execute({ clienteId: "c1", nome: "A", jornada: [1, 2] })).ok).toBe(
      false,
    );
    expect(
      (await t.cadastrar.execute({ clienteId: "c1", nome: "A", jornada: [0, 0, 0, 0, 0, 0, 1441] }))
        .ok,
    ).toBe(false);
    expect(t.repositorio.cadastrarEmpregado).not.toHaveBeenCalled();
  });

  it("corrigir, inativar e padrão passam pelo mesmo crivo", async () => {
    const t = montar(OUTRO);
    expect(
      (
        await t.corrigir.execute({
          empregadoId: "e1",
          nome: "Ana",
          jornada: JORNADA,
          comissionado: true,
        })
      ).ok,
    ).toBe(false);
    expect((await t.ativo.execute({ empregadoId: "e1", ativo: false })).ok).toBe(false);
    expect((await t.padrao.execute({ clienteId: "c1", comissionados: true })).ok).toBe(false);
    const certo = montar(FUNC);
    expect((await certo.ativo.execute({ empregadoId: "e1", ativo: false })).ok).toBe(true);
    expect(certo.repositorio.definirAtivo).toHaveBeenCalledWith("e1", false);
  });

  it("a recusa de reativar e a de inativar são auditadas com a ação de cada uma", async () => {
    const t = montar(OUTRO);
    await t.ativo.execute({ empregadoId: "e1", ativo: true });
    await t.ativo.execute({ empregadoId: "e1", ativo: false });
    const acoes = (t.auditoria.registrar.mock.calls as unknown as [{ acao: string }][]).map(
      ([e]) => e.acao,
    );
    expect(acoes).toEqual(["rh.empregado.reativar", "rh.empregado.inativar"]);
  });

  it("sem movimento: mês futuro é recusado; mês corrente grava no dia 1", async () => {
    const t = montar(FUNC);
    expect(
      (await t.semMovimento.execute({ empregadoId: "e1", competencia: "2027-01", sem: true })).ok,
    ).toBe(false);
    await t.semMovimento.execute({ empregadoId: "e1", competencia: "2026-11", sem: true });
    expect(t.repositorio.definirSemMovimento).toHaveBeenCalledWith("e1", "2026-11-01", true);
  });

  it("empregado inexistente ou fora da vista é 'não encontrado'", async () => {
    const t = montar(FUNC);
    t.repositorio.buscarClienteDoEmpregado.mockResolvedValueOnce(ok(null));
    const r = await t.ativo.execute({ empregadoId: "x", ativo: false });
    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
  });
});

describe("SalvarDiaDoPonto", () => {
  const dia = {
    empregadoId: "e1",
    data: "2026-11-16",
    batidas: [{ entrada: 480, saida: 720 }],
    extra: null,
    abono: false,
  };

  it("grava o dia do Responsável", async () => {
    const t = montar(FUNC);
    expect((await t.salvarDia.execute(dia)).ok).toBe(true);
    expect(t.repositorio.salvarDia).toHaveBeenCalledWith("e1", {
      data: dia.data,
      batidas: dia.batidas,
      extra: null,
      abono: false,
    });
  });

  it("recusa dia de mês futuro, sem gravar; o dia do mês corrente passa", async () => {
    const t = montar(FUNC);
    expect((await t.salvarDia.execute({ ...dia, data: "2026-12-01" })).ok).toBe(false);
    expect(t.repositorio.salvarDia).not.toHaveBeenCalled();
    expect((await t.salvarDia.execute({ ...dia, data: "2026-11-30" })).ok).toBe(true);
  });

  it("recusa data inválida, mais de 4 pares, horário fora do dia e par de 24 horas", async () => {
    const t = montar(FUNC);
    const par = { entrada: 480, saida: 720 };
    expect((await t.salvarDia.execute({ ...dia, data: "2026-02-30x" })).ok).toBe(false);
    expect((await t.salvarDia.execute({ ...dia, data: "2026-02-31" })).ok).toBe(false);
    expect((await t.salvarDia.execute({ ...dia, batidas: Array(5).fill(par) })).ok).toBe(false);
    expect(
      (await t.salvarDia.execute({ ...dia, batidas: [{ entrada: 480, saida: 1440 }] })).ok,
    ).toBe(false);
    expect((await t.salvarDia.execute({ ...dia, extra: { entrada: 480, saida: 480 } })).ok).toBe(
      false,
    );
    expect(t.repositorio.salvarDia).not.toHaveBeenCalled();
  });

  it("quem não é o Responsável é barrado", async () => {
    const t = montar(LIDER);
    expect((await t.salvarDia.execute(dia)).ok).toBe(false);
    expect(t.repositorio.salvarDia).not.toHaveBeenCalled();
  });
});
