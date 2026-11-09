import type { ClienteAcompanhamentoDto } from "@/modules/rh/application/dtos/acompanhamento.dto";
import type { AcompanhamentoRepository } from "@/modules/rh/application/ports/out/acompanhamento.repository";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { ok } from "@/shared/kernel/result";

import { ObterAcompanhamentoFuncionarios } from "./obter-acompanhamento-funcionarios.use-case";

const AGORA = new Date("2026-11-15T15:00:00Z");
const relogio = { agora: () => AGORA };

const FGTS = { id: "s-fgts", nome: "FGTS", sistema: false };
const HOLERITE = { id: "s-hol", nome: "Holerite", sistema: true };
const ANA = { id: "u-ana", nome: "Ana" };
const BIA = { id: "u-bia", nome: "Bia" };

function cliente(
  id: string,
  responsavel: { id: string; nome: string } | null,
  concluidos: string[],
  naoAplica: string[] = [],
): ClienteAcompanhamentoDto {
  return { clienteId: id, empresa: `Empresa ${id}`, cnpj: id, naoAplica, concluidos, responsavel };
}

// Novembro: Ana fecha c1 e deixa c2 sem nada; Bia tem c3 só sem o Holerite; c4 não tem Responsável.
// Outubro: Ana fechou os dois clientes.
const POR_MES: Record<string, ClienteAcompanhamentoDto[]> = {
  "2026-11-01": [
    cliente("c1", ANA, ["s-fgts", "s-hol"]),
    cliente("c2", ANA, []),
    cliente("c3", BIA, ["s-fgts"]),
    cliente("c4", null, []),
  ],
  "2026-10-01": [cliente("c1", ANA, ["s-fgts", "s-hol"]), cliente("c2", ANA, ["s-fgts", "s-hol"])],
};

function montar(papel: string, setor = "rh") {
  const sessao: SessaoPort = { usuarioAtual: async () => ({ id: "u1", papel, setor }) };
  const chamadas: unknown[][] = [];
  const repositorio = {
    listarServicos: async () => ok([FGTS, HOLERITE]),
    listarClientes: async (...args: unknown[]) => {
      chamadas.push(args);
      return ok(POR_MES[args[0] as string] ?? []);
    },
  } as unknown as AcompanhamentoRepository;
  return { caso: new ObterAcompanhamentoFuncionarios(sessao, repositorio, relogio), chamadas };
}

describe("ObterAcompanhamentoFuncionarios", () => {
  it("só o Líder do RH e o Admin veem; o Funcionário não", async () => {
    expect((await montar("funcionario").caso.execute({})).ok).toBe(false);
    expect((await montar("lider_setor", "fiscal").caso.execute({})).ok).toBe(false);
    expect((await montar("lider_setor").caso.execute({})).ok).toBe(true);
    expect((await montar("admin", "administrativo").caso.execute({})).ok).toBe(true);
  });

  it("pontua o cliente só com todo serviço aplicável e o Holerite concluídos", async () => {
    const r = await montar("lider_setor").caso.execute({});

    expect(r.ok && r.value.funcionarios).toEqual([
      {
        ...ANA,
        atribuidos: 2,
        pontos: 1,
        faltam: [
          { servicoId: "s-fgts", nome: "FGTS", clientes: 1 },
          { servicoId: "s-hol", nome: "Holerite", clientes: 1 },
        ],
      },
      {
        ...BIA,
        atribuidos: 1,
        pontos: 0,
        faltam: [
          { servicoId: "s-fgts", nome: "FGTS", clientes: 0 },
          { servicoId: "s-hol", nome: "Holerite", clientes: 1 },
        ],
      },
    ]);
  });

  it("serviço que não se aplica não conta como pendente", async () => {
    POR_MES["2026-11-01"].push(cliente("c5", BIA, ["s-hol"], ["s-fgts"]));

    const r = await montar("lider_setor").caso.execute({});

    expect(r.ok && r.value.funcionarios[1]).toMatchObject({ atribuidos: 2, pontos: 1 });
    POR_MES["2026-11-01"].pop();
  });

  it("cliente sem Responsável aparece à parte e não conta para ninguém", async () => {
    const { caso, chamadas } = montar("admin", "administrativo");

    const r = await caso.execute({});

    expect(r.ok && r.value.semResponsavel).toEqual([{ clienteId: "c4", empresa: "Empresa c4" }]);
    expect(chamadas).toContainEqual(["2026-11-01", null, true]);
  });

  it("a lista lê só o mês consultado; a janela de meses é do detalhe", async () => {
    const lista = montar("lider_setor");
    await lista.caso.execute({});
    const detalhe = montar("lider_setor");
    await detalhe.caso.execute({ funcionarioId: "u-ana" });

    expect(lista.chamadas).toHaveLength(1);
    expect(detalhe.chamadas).toHaveLength(6);
  });

  it("o detalhe agrupa os pendentes pelo serviço que falta, mostra evolução e os mais atrasados", async () => {
    const r = await montar("lider_setor").caso.execute({ funcionarioId: "u-ana" });

    const detalhe = r.ok ? r.value.detalhe : undefined;
    expect(detalhe?.pendencias).toEqual([
      { servicoId: "s-fgts", nome: "FGTS", clientes: [{ clienteId: "c2", empresa: "Empresa c2" }] },
      {
        servicoId: "s-hol",
        nome: "Holerite",
        clientes: [{ clienteId: "c2", empresa: "Empresa c2" }],
      },
    ]);
    expect(detalhe?.evolucao.slice(-2)).toEqual([
      { competencia: "2026-10", pontos: 2, atribuidos: 2 },
      { competencia: "2026-11", pontos: 1, atribuidos: 2 },
    ]);
    expect(detalhe?.evolucao).toHaveLength(6);
    expect(detalhe?.maisAtrasados).toEqual([{ clienteId: "c2", empresa: "Empresa c2", meses: 1 }]);
  });

  it("funcionário sem clientes no mês não tem detalhe", async () => {
    const r = await montar("lider_setor").caso.execute({ funcionarioId: "u-zed" });

    expect(r.ok && r.value.detalhe).toBeUndefined();
  });

  it("mês futuro é recusado", async () => {
    const r = await montar("lider_setor").caso.execute({ competencia: "2026-12" });

    expect(r.ok).toBe(false);
  });
});
