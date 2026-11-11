import type { AcompanhamentoRepository } from "@/modules/rh/application/ports/out/acompanhamento.repository";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { ok } from "@/shared/kernel/result";

import { ObterAcompanhamentoMensal } from "./obter-acompanhamento-mensal.use-case";

const AGORA = new Date("2026-11-15T15:00:00Z");
const relogio = { agora: () => AGORA };

const FGTS = { id: "s-fgts", nome: "FGTS", sistema: false };
const HOLERITE = { id: "s-hol", nome: "Holerite", sistema: true };

function montar(
  papel: string,
  setor = "rh",
  holerite = { cadastrados: 1, semMovimento: 0, cartoes: 0 },
) {
  const chamadas: { competencia: string; responsavelId: string | null }[] = [];
  const sessao: SessaoPort = { usuarioAtual: async () => ({ id: "u1", papel, setor }) };
  const repositorio = {
    listarServicos: async () => ok([FGTS, HOLERITE]),
    listarClientes: async (competencia: string, responsavelId: string | null) => {
      chamadas.push({ competencia, responsavelId });
      return ok([
        {
          clienteId: "c1",
          empresa: "Alfa Ltda",
          cnpj: "11444777000161",
          naoAplica: ["s-fgts"],
          naoAplicaSempre: ["s-fgts"],
          concluidos: [],
          holerite,
        },
        {
          clienteId: "c2",
          empresa: "Beta Ltda",
          cnpj: "11222333000181",
          naoAplica: [],
          naoAplicaSempre: [],
          concluidos: ["s-fgts"],
          holerite,
        },
      ]);
    },
  } as unknown as AcompanhamentoRepository;
  return { caso: new ObterAcompanhamentoMensal(sessao, repositorio, relogio), chamadas };
}

describe("ObterAcompanhamentoMensal", () => {
  it("sem competência usa o mês corrente e começa tudo pendente", async () => {
    const { caso, chamadas } = montar("funcionario");

    const r = await caso.execute({});

    expect(r.ok && r.value.competencia).toBe("2026-11");
    expect(chamadas[0].competencia).toBe("2026-11-01");
    expect(r.ok && r.value.linhas[1].celulas).toEqual([
      { servicoId: "s-fgts", aplica: true, sempre: false, concluido: true },
      { servicoId: "s-hol", aplica: true, sempre: false, concluido: false },
    ]);
  });

  it("o Holerite conclui com os cartões do mês, dispensa o cliente sem empregados e reabre", async () => {
    const celulaDoHolerite = async (holerite: {
      cadastrados: number;
      semMovimento: number;
      cartoes: number;
    }) => {
      const r = await montar("lider_setor", "rh", holerite).caso.execute({});
      return r.ok ? r.value.linhas[1].celulas[1] : undefined;
    };

    expect(await celulaDoHolerite({ cadastrados: 2, semMovimento: 0, cartoes: 2 })).toMatchObject({
      aplica: true,
      concluido: true,
    });
    expect(await celulaDoHolerite({ cadastrados: 2, semMovimento: 1, cartoes: 1 })).toMatchObject({
      aplica: true,
      concluido: true,
    });
    expect(await celulaDoHolerite({ cadastrados: 0, semMovimento: 0, cartoes: 0 })).toMatchObject({
      aplica: false,
      concluido: false,
    });
    expect(await celulaDoHolerite({ cadastrados: 2, semMovimento: 0, cartoes: 1 })).toMatchObject({
      aplica: true,
      concluido: false,
    });
  });

  it("devolve a contagem de empregados e cartões de cada cliente", async () => {
    const r = await montar("lider_setor", "rh", {
      cadastrados: 3,
      semMovimento: 1,
      cartoes: 2,
    }).caso.execute({});

    expect(r.ok && r.value.linhas[0].holerite).toEqual({
      cadastrados: 3,
      semMovimento: 1,
      cartoes: 2,
      exigidos: 2,
    });
  });

  it("serviço que não se aplica ao cliente vem marcado como tal", async () => {
    const { caso } = montar("lider_setor");

    const r = await caso.execute({ competencia: "2026-10" });

    expect(r.ok && r.value.linhas[0].celulas[0]).toEqual({
      servicoId: "s-fgts",
      aplica: false,
      sempre: true,
      concluido: false,
    });
  });

  it("o Funcionário lê só os seus clientes; Líder e Admin leem todos", async () => {
    const func = montar("funcionario");
    const lider = montar("lider_setor");
    const admin = montar("admin", "administrativo");

    await func.caso.execute({});
    await lider.caso.execute({});
    await admin.caso.execute({});

    expect(func.chamadas[0].responsavelId).toBe("u1");
    expect(lider.chamadas[0].responsavelId).toBeNull();
    expect(admin.chamadas[0].responsavelId).toBeNull();
  });

  it("só o Funcionário marca e só o Líder gere serviços", async () => {
    const func = await montar("funcionario").caso.execute({});
    const lider = await montar("lider_setor").caso.execute({});
    const admin = await montar("admin", "administrativo").caso.execute({});

    expect(func.ok && func.value.podeMarcar).toBe(true);
    expect(lider.ok && lider.value.podeMarcar).toBe(false);
    expect(admin.ok && admin.value.podeMarcar).toBe(false);
  });

  it("recusa quem é de outro setor", async () => {
    const r = await montar("funcionario", "simples_nacional").caso.execute({});
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });

  it("recusa mês futuro e competência malformada", async () => {
    const { caso } = montar("funcionario");

    const futuro = await caso.execute({ competencia: "2026-12" });
    const ruim = await caso.execute({ competencia: "novembro" });

    expect(!futuro.ok && futuro.error.code).toBe("VALIDATION_ERROR");
    expect(!ruim.ok && ruim.error.code).toBe("VALIDATION_ERROR");
  });
});
