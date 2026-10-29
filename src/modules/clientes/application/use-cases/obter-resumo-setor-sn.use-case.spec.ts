import type {
  CadastroOperacionalClienteDto,
  ClienteQueryPort,
  ResumoOperacionalRow,
  SugestaoClienteDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { RelogioPort } from "@/modules/clientes/application/ports/out/relogio.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { ObterResumoSetorSn } from "./obter-resumo-setor-sn.use-case";

class ClienteQueryPortFalso implements ClienteQueryPort {
  linhas: ResumoOperacionalRow[] = [];
  erro: AppError | null = null;

  async buscarCadastroOperacional(): Promise<
    Result<CadastroOperacionalClienteDto | null, AppError>
  > {
    return ok(null);
  }
  async buscarPorTermo(): Promise<Result<SugestaoClienteDto[], AppError>> {
    return ok([]);
  }
  async listarResumoOperacional(): Promise<Result<ResumoOperacionalRow[], AppError>> {
    return this.erro ? err(this.erro) : ok(this.linhas);
  }
  async listarResponsaveisElegiveis() {
    return ok([]);
  }
  async buscarResponsavelDoSetor() {
    return ok(null);
  }
}

const sessaoDe = (papel: string, setor: string): SessaoPort => ({
  usuarioAtual: async () => ({ id: "u1", papel, setor }),
});
// 2026-10-28 e 2026-10-29 ao meio-dia em São Paulo: antes e depois da última rodada do job.
const relogioEm = (iso: string): RelogioPort => ({ agora: () => new Date(iso) });
const DIA_28 = relogioEm("2026-10-28T15:00:00Z");
const DIA_29 = relogioEm("2026-10-29T15:00:00Z");
const SEM_SESSAO: SessaoPort = { usuarioAtual: async () => null };

describe("ObterResumoSetorSn", () => {
  it("devolve o total de clientes e os 11 cards classificados", async () => {
    const query = new ClienteQueryPortFalso();
    query.linhas = [
      {
        clienteId: "1",
        empresa: "A",
        cnpj: "1",
        documentoObrigatorio: null,
        dasStatus: "enviado",
        parcelamentos: [],
        atividadeMes: { industria: true, comercio: false, servico: false },
        responsavelId: null,
        responsavelNome: null,
      },
      {
        clienteId: "2",
        empresa: "B",
        cnpj: "2",
        documentoObrigatorio: "negativo",
        dasStatus: null,
        parcelamentos: [],
        atividadeMes: { industria: true, comercio: false, servico: false },
        responsavelId: null,
        responsavelNome: null,
      },
    ];

    const resultado = await new ObterResumoSetorSn(
      sessaoDe("funcionario", "simples_nacional"),
      query,
      DIA_28,
    ).execute();

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.value.totalClientes).toBe(2);
    expect(resultado.value.cards).toHaveLength(11);
    expect(resultado.value.comparativos.das.find((f) => f.id === "enviado")?.quantidade).toBe(1);
    expect(
      resultado.value.comparativos.atividade.find((f) => f.id === "industria")?.quantidade,
    ).toBe(2);
    expect(resultado.value.cards.find((c) => c.id === "das_emitidas")?.quantidade).toBe(1);
    expect(resultado.value.cards.find((c) => c.id === "sem_documento")?.quantidade).toBe(1);
  });

  it("cards e comparativos de parcelamento saem das mesmas definições (Clientes, não parcelamentos)", async () => {
    const query = new ClienteQueryPortFalso();
    const base = {
      empresa: "E",
      cnpj: "1",
      documentoObrigatorio: null,
      dasStatus: null,
      responsavelId: null,
      responsavelNome: null,
      atividadeMes: { industria: false, comercio: false, servico: false },
    };
    const p = (o: object = {}) => ({
      codigo: "P",
      interno: false,
      quitado: false,
      enviadoNoMes: false,
      ...o,
    });
    query.linhas = [
      { ...base, clienteId: "1", parcelamentos: [p(), p({ codigo: "Q", interno: true })] },
      { ...base, clienteId: "2", parcelamentos: [p({ enviadoNoMes: true })] },
    ];

    const r = await new ObterResumoSetorSn(
      sessaoDe("funcionario", "simples_nacional"),
      query,
      DIA_28,
    ).execute();

    if (!r.ok) throw new Error("falha inesperada");
    const card = (id: string) => r.value.cards.find((c) => c.id === id)?.quantidade;
    const fatia = (id: string) =>
      r.value.comparativos.parcelamento.find((f) => f.id === id)?.quantidade;
    expect(card("com_parcelamento")).toBe(2);
    expect(card("parcelamento_pendente")).toBe(fatia("pendente"));
    expect(card("parcelamento_enviado")).toBe(fatia("enviado"));
    expect(card("parcelamento_interno")).toBe(fatia("interno"));
  });

  it("o atraso do parcelamento segue o relógio injetado, em cards e comparativos", async () => {
    const query = new ClienteQueryPortFalso();
    query.linhas = [
      {
        clienteId: "1",
        empresa: "A",
        cnpj: "1",
        documentoObrigatorio: null,
        dasStatus: null,
        parcelamentos: [{ codigo: "P", interno: false, quitado: false, enviadoNoMes: false }],
        atividadeMes: { industria: false, comercio: false, servico: false },
        responsavelId: null,
        responsavelNome: null,
      },
    ];
    const sessao = sessaoDe("funcionario", "simples_nacional");
    const atrasoEm = async (relogio: RelogioPort) => {
      const r = await new ObterResumoSetorSn(sessao, query, relogio).execute();
      if (!r.ok) throw new Error("falha inesperada");
      return {
        card: r.value.cards.find((c) => c.id === "parcelamento_pendente_atraso")?.quantidade,
        fatia: r.value.comparativos.parcelamento.find((f) => f.id === "em_atraso")?.quantidade,
      };
    };

    expect(await atrasoEm(DIA_28)).toEqual({ card: 0, fatia: 0 });
    expect(await atrasoEm(DIA_29)).toEqual({ card: 1, fatia: 1 });
  });

  it("o 4º comparativo (Responsáveis) só vai pro Líder do Simples Nacional", async () => {
    const query = new ClienteQueryPortFalso();
    const comparativosPara = async (sessao: SessaoPort) => {
      const r = await new ObterResumoSetorSn(sessao, query, DIA_28).execute();
      if (!r.ok) throw new Error("falha inesperada");
      return r.value.comparativos;
    };

    expect(
      (await comparativosPara(sessaoDe("lider_setor", "simples_nacional"))).responsaveis,
    ).toEqual([]);
    for (const sessao of [
      sessaoDe("funcionario", "simples_nacional"),
      sessaoDe("admin", "administrativo"),
    ]) {
      expect("responsaveis" in (await comparativosPara(sessao))).toBe(false);
    }
  });

  it.each([
    ["funcionario", "financeiro"],
    ["lider_setor", "administrativo"],
  ])("recusa %s do setor %s antes de consultar", async (papel, setor) => {
    const consultas: string[] = [];
    const query = new ClienteQueryPortFalso();
    const listar = query.listarResumoOperacional.bind(query);
    query.listarResumoOperacional = async () => {
      consultas.push("listarResumoOperacional");
      return listar();
    };

    const resultado = await new ObterResumoSetorSn(sessaoDe(papel, setor), query, DIA_28).execute();

    expect(!resultado.ok && resultado.error.code).toBe("FORBIDDEN");
    expect(consultas).toEqual([]);
  });

  it("Admin e Líder/Funcionário do Simples Nacional continuam autorizados", async () => {
    for (const sessao of [
      sessaoDe("admin", "administrativo"),
      sessaoDe("lider_setor", "simples_nacional"),
      sessaoDe("funcionario", "simples_nacional"),
    ]) {
      expect(
        (await new ObterResumoSetorSn(sessao, new ClienteQueryPortFalso(), DIA_28).execute()).ok,
      ).toBe(true);
    }
  });

  it("recusa sem sessão, antes de consultar", async () => {
    const query = new ClienteQueryPortFalso();
    query.erro = new ForbiddenError("não deveria consultar");

    const resultado = await new ObterResumoSetorSn(SEM_SESSAO, query, DIA_28).execute();

    expect(!resultado.ok && resultado.error.message).toMatch(/login/);
  });

  it("propaga o erro técnico quando a consulta falha", async () => {
    const query = new ClienteQueryPortFalso();
    query.erro = new ForbiddenError("Falha ao listar");

    const resultado = await new ObterResumoSetorSn(
      sessaoDe("funcionario", "simples_nacional"),
      query,
      DIA_28,
    ).execute();

    expect(!resultado.ok && resultado.error.message).toBe("Falha ao listar");
  });
});
