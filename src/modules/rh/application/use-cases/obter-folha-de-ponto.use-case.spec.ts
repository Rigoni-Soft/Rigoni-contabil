import type { ConvencaoDto } from "@/modules/rh/application/dtos/convencao.dto";
import type { EmpregadoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import type { ConvencaoRepository } from "@/modules/rh/application/ports/out/convencao.repository";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { AtorSessaoDto } from "@/modules/rh/application/ports/out/sessao.provider";
import { ObterFolhaDePonto } from "@/modules/rh/application/use-cases/obter-folha-de-ponto.use-case";
import { hm } from "@/modules/rh/domain/services/totalizacao.service";
import { ok } from "@/shared/kernel/result";

const FUNC: AtorSessaoDto = { id: "func", papel: "funcionario", setor: "rh" };
const LIDER: AtorSessaoDto = { id: "lider", papel: "lider_setor", setor: "rh" };
const SN: AtorSessaoDto = { id: "sn", papel: "funcionario", setor: "simples_nacional" };

const ANA: EmpregadoDto = {
  id: "e1",
  nome: "Ana",
  jornada: [0, 525, 525, 525, 525, 525, 240],
  comissionado: false,
  ativo: true,
};
const BIA: EmpregadoDto = { ...ANA, id: "e2", nome: "Bia", ativo: false };

function repo(over: Partial<FolhaDePontoRepository> = {}): FolhaDePontoRepository {
  return {
    buscarCliente: async () => ok({ cnpj: "1", empresa: "Teste Ltda", responsavelId: "func" }),
    buscarClienteDoEmpregado: async () => ok("c1"),
    listarEmpregados: async () => ok([BIA, ANA]),
    listarSemMovimento: async () => ok(["e1"]),
    buscarPadraoComissionados: async () => ok(true),
    definirPadraoComissionados: async () => ok(undefined),
    cadastrarEmpregado: async () => ok(undefined),
    corrigirEmpregado: async () => ok(undefined),
    definirAtivo: async () => ok(undefined),
    definirSemMovimento: async () => ok(undefined),
    listarDias: async () => ok([]),
    salvarDia: async () => ok(undefined),
    listarFeriados: async () => ok([]),
    buscarInterruptores: async () => ok({ bancoDeHoras: false, trabalhoAosDomingos: false }),
    definirInterruptores: async () => ok(undefined),
    listarConvencaoDosEmpregados: async () => ok([]),
    definirConvencaoDoEmpregado: async () => ok(undefined),
    ...over,
  };
}

const CONVENCAO: ConvencaoDto = {
  id: "v1",
  sindicato: "Comerciários",
  vigenciaInicio: "2026-01-01",
  vigenciaFim: "2026-12-31",
  arquivoNome: "c.pdf",
  enviadaEm: "2026-01-02",
  regras: {
    versao: 1,
    rejeitadas: [],
    aplicadas: [{ chave: "extra_sabado", valor: 60, clausula: "12ª", trecho: "60%" }],
  },
};
const convencoes = (lista: ConvencaoDto[] = []): ConvencaoRepository => ({
  listar: async () => ok(lista),
  inserir: async () => ok(undefined),
});

// 20/11/2026: mês corrente.
const relogio = { agora: () => new Date("2026-11-20T15:00:00Z") };
const obter = (ator: AtorSessaoDto | null, r = repo(), c = convencoes()) =>
  new ObterFolhaDePonto({ usuarioAtual: async () => ator }, r, c, relogio);

describe("ObterFolhaDePonto", () => {
  it("barra quem não é do RH nem Admin", async () => {
    const r = await obter(SN).execute({ clienteId: "c1" });
    expect(r.ok).toBe(false);
  });

  it("abre no mês corrente, sem empregado escolhido, com o padrão do Cliente", async () => {
    const r = await obter(FUNC).execute({ clienteId: "c1" });
    if (!r.ok) throw r.error;
    expect(r.value).toMatchObject({
      competencia: "2026-11",
      padraoComissionados: true,
      selecionado: null,
    });
    expect(r.value.empregados.find((e) => e.id === "e1")?.semMovimento).toBe(true);
  });

  it("com o empregado pedido traz o cartão dele", async () => {
    const r = await obter(FUNC).execute({ clienteId: "c1", empregadoId: "e1" });
    if (!r.ok) throw r.error;
    expect(r.value.selecionado?.empregado.nome).toBe("Ana");
    expect(r.value.empregados.find((e) => e.id === "e1")?.semMovimento).toBe(true);
    // O cartão mostra o mês inteiro: novembro tem 30 dias, do 01 ao 30.
    expect(r.value.selecionado?.dias).toHaveLength(30);
    expect(r.value.selecionado?.dias[0].data).toBe("2026-11-01");
    expect(r.value.selecionado?.dias[29].data).toBe("2026-11-30");
  });

  it("só o Responsável edita; o Líder lê", async () => {
    const f = await obter(FUNC).execute({ clienteId: "c1" });
    const l = await obter(LIDER).execute({ clienteId: "c1" });
    expect(f.ok && f.value.podeEditar).toBe(true);
    expect(l.ok && l.value.podeEditar).toBe(false);
  });

  it("totaliza o cartão lançado: falta, feriado e dia cumprido", async () => {
    const r = await obter(
      FUNC,
      repo({
        listarFeriados: async () => ok(["2026-11-20"]),
        listarDias: async () =>
          ok([
            {
              data: "2026-11-16",
              batidas: [
                { entrada: hm("08:00"), saida: hm("12:00") },
                { entrada: hm("13:00"), saida: hm("17:45") },
              ],
              extra: null,
              abono: false,
            },
          ]),
      }),
    ).execute({ clienteId: "c1", empregadoId: "e1", competencia: "2026-11" });
    if (!r.ok) throw r.error;
    // Mês inteiro: 25 dias de seg a sáb; o 16 foi cumprido e o 20 é feriado, sobram 23 faltas; domingos são ignorados.
    expect(r.value.selecionado?.totalizacao).toMatchObject({ normaisMin: 525, faltas: 23 });
  });

  it("empregado pedido que não é do Cliente não existe", async () => {
    const r = await obter(FUNC).execute({ clienteId: "c1", empregadoId: "outro" });
    expect(r.ok).toBe(false);
  });

  it("cliente fora da vista não existe; mês futuro é recusado", async () => {
    const sem = await obter(FUNC, repo({ buscarCliente: async () => ok(null) })).execute({
      clienteId: "c1",
    });
    expect(sem.ok).toBe(false);
    const futuro = await obter(FUNC).execute({ clienteId: "c1", competencia: "2027-01" });
    expect(futuro.ok).toBe(false);
  });

  describe("convenção na Totalização", () => {
    // Sábado 21/11: 4h de carga, 5h batidas = 1h extra.
    const sabado = {
      listarDias: async () =>
        ok([
          {
            data: "2026-11-21",
            batidas: [{ entrada: hm("08:00"), saida: hm("13:00") }],
            extra: null,
            abono: false,
          },
        ]),
    };
    const extrasDe = async (c: ConvencaoDto[], r = repo(sabado)) => {
      const folha = await obter(FUNC, r, convencoes(c)).execute({
        clienteId: "c1",
        empregadoId: "e1",
      });
      if (!folha.ok) throw folha.error;
      return folha.value.selecionado!;
    };

    it("com convenção vigente a hora extra de sábado usa o percentual dela", async () => {
      const s = await extrasDe([CONVENCAO]);
      expect(s.totalizacao.extras).toEqual([{ percentual: 60, minutos: 60 }]);
      expect(s.semConvencao).toBe(false);
    });

    it("sem convenção vale a legislação e a folha avisa", async () => {
      const s = await extrasDe([]);
      expect(s.totalizacao.extras).toEqual([{ percentual: 50, minutos: 60 }]);
      expect(s.semConvencao).toBe(true);
    });

    it("mês sem nenhum lançamento não avisa: a convenção não mudaria nada", async () => {
      const s = await extrasDe([], repo());
      expect(s.semConvencao).toBe(false);
    });

    it("convenção que já venceu não vale: usa a da época do cartão", async () => {
      const velha = { ...CONVENCAO, vigenciaInicio: "2025-01-01", vigenciaFim: "2025-12-31" };
      expect((await extrasDe([velha])).totalizacao.extras).toEqual([
        { percentual: 50, minutos: 60 },
      ]);
    });

    it("o empregado que aponta outro sindicato usa a convenção dele", async () => {
      const outra = {
        ...CONVENCAO,
        id: "v2",
        sindicato: "Outro",
        regras: { versao: 1, aplicadas: [], rejeitadas: [] },
      };
      const r = repo({
        ...sabado,
        listarConvencaoDosEmpregados: async () => ok([{ empregadoId: "e1", sindicato: "Outro" }]),
      });
      const s = await extrasDe([CONVENCAO, outra], r);
      expect(s.totalizacao.extras).toEqual([{ percentual: 50, minutos: 60 }]);
      expect(s.semConvencao).toBe(false);
    });

    it("o banco de horas ligado no Cliente leva a extra ao banco", async () => {
      const r = repo({
        ...sabado,
        buscarInterruptores: async () => ok({ bancoDeHoras: true, trabalhoAosDomingos: false }),
      });
      const s = await extrasDe([CONVENCAO], r);
      expect(s.totalizacao).toMatchObject({ extras: [], bancoDeHorasMin: 60 });
    });
  });
});
