import type { AcompanhamentoRepository } from "@/modules/rh/application/ports/out/acompanhamento.repository";
import type { RegistrarAcaoAuditoria } from "@/modules/rh/application/ports/out/auditoria.provider";
import { ok } from "@/shared/kernel/result";

import {
  DefinirServicoAplicavel,
  MarcarServicoAcompanhamento,
} from "./marcar-servico-acompanhamento.use-case";

const relogio = { agora: () => new Date("2026-11-15T15:00:00Z") };

function montar(
  ator: { papel: string; setor: string } | null,
  responsavelId: string | null = "u1",
) {
  const gravacoes: unknown[][] = [];
  const falhas: RegistrarAcaoAuditoria[] = [];
  const repositorio = {
    buscarCliente: async () => ok({ cnpj: "11444777000161", responsavelId }),
    listarServicos: async () =>
      ok([
        { id: "s-fgts", nome: "FGTS", sistema: false },
        { id: "s-hol", nome: "Holerite", sistema: true },
      ]),
    marcar: async (...args: unknown[]) => {
      gravacoes.push(["marcar", ...args]);
      return ok(undefined);
    },
    definirAplica: async (...args: unknown[]) => {
      gravacoes.push(["aplica", ...args]);
      return ok(undefined);
    },
  } as unknown as AcompanhamentoRepository;
  const sessao = { usuarioAtual: async () => (ator ? { id: "u1", ...ator } : null) };
  const auditoria = { registrar: async (i: RegistrarAcaoAuditoria) => void falhas.push(i) };
  return {
    marcar: new MarcarServicoAcompanhamento(sessao, repositorio, auditoria, relogio),
    aplicar: new DefinirServicoAplicavel(sessao, repositorio, auditoria),
    gravacoes,
    falhas,
  };
}

const FUNC_RH = { papel: "funcionario", setor: "rh" };
const entrada = { clienteId: "c1", servicoId: "s-fgts", competencia: "2026-11", concluido: true };

const aplicarEntrada = {
  clienteId: "c1",
  servicoId: "s-fgts",
  competencia: "2026-11",
  escopo: "mes" as const,
};

describe("MarcarServicoAcompanhamento", () => {
  it("o Responsável marca o serviço na competência", async () => {
    const { marcar, gravacoes } = montar(FUNC_RH);

    const r = await marcar.execute(entrada);

    expect(r.ok).toBe(true);
    expect(gravacoes).toEqual([["marcar", "c1", "s-fgts", "2026-11-01", true, "u1"]]);
  });

  it("desmarca com concluido=false", async () => {
    const { marcar, gravacoes } = montar(FUNC_RH);
    await marcar.execute({ ...entrada, concluido: false });
    expect(gravacoes[0][4]).toBe(false);
  });

  it.each([
    ["Funcionário que não é o Responsável", FUNC_RH, "outro"],
    ["Líder do RH", { papel: "lider_setor", setor: "rh" }, "u1"],
    ["Admin", { papel: "admin", setor: "administrativo" }, "u1"],
    ["Funcionário de outro setor", { papel: "funcionario", setor: "simples_nacional" }, "u1"],
  ])("recusa e audita a falha: %s", async (_nome, ator, responsavel) => {
    const { marcar, gravacoes, falhas } = montar(ator, responsavel);

    const r = await marcar.execute(entrada);

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(gravacoes).toEqual([]);
    expect(falhas).toEqual([
      expect.objectContaining({ acao: "rh.acompanhamento.marcar", resultado: "falha" }),
    ]);
  });

  it("recusa o Holerite (serviço do sistema)", async () => {
    const { marcar, gravacoes } = montar(FUNC_RH);
    const r = await marcar.execute({ ...entrada, servicoId: "s-hol" });
    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(gravacoes).toEqual([]);
  });

  it("recusa serviço fora da tabela do mês, mês futuro e sem sessão", async () => {
    const { marcar } = montar(FUNC_RH);
    const fora = await marcar.execute({ ...entrada, servicoId: "s-antigo" });
    const futuro = await marcar.execute({ ...entrada, competencia: "2026-12" });
    const semSessao = await montar(null).marcar.execute(entrada);

    expect(!fora.ok && fora.error.code).toBe("NOT_FOUND");
    expect(!futuro.ok && futuro.error.code).toBe("VALIDATION_ERROR");
    expect(!semSessao.ok && semSessao.error.code).toBe("FORBIDDEN");
  });
});

describe("DefinirServicoAplicavel", () => {
  it("o Responsável marca o serviço como não aplicável", async () => {
    const { aplicar, gravacoes } = montar(FUNC_RH);
    const r = await aplicar.execute(aplicarEntrada);
    expect(r.ok).toBe(true);
    expect(gravacoes).toEqual([["aplica", "c1", "s-fgts", "2026-11-01", "mes"]]);
  });

  it("recusa o Holerite e o serviço fora da tabela do mês, sem gravar", async () => {
    const { aplicar, gravacoes } = montar(FUNC_RH);
    const hol = await aplicar.execute({ ...aplicarEntrada, servicoId: "s-hol" });
    const fora = await aplicar.execute({ ...aplicarEntrada, servicoId: "s-antigo" });
    expect(!hol.ok && hol.error.code).toBe("VALIDATION_ERROR");
    expect(!fora.ok && fora.error.code).toBe("NOT_FOUND");
    expect(gravacoes).toEqual([]);
  });

  it("recusa quem não é o Responsável e audita a ação tentada", async () => {
    const { aplicar, gravacoes, falhas } = montar(FUNC_RH, "outro");
    const r = await aplicar.execute(aplicarEntrada);
    await aplicar.execute({ ...aplicarEntrada, escopo: "aplica" });
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(gravacoes).toEqual([]);
    expect(falhas.map((f) => f.acao)).toEqual([
      "rh.acompanhamento.nao-aplicar",
      "rh.acompanhamento.aplicar",
    ]);
  });
});
