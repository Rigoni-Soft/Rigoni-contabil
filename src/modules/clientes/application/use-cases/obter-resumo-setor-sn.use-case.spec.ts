import type {
  CadastroOperacionalClienteDto,
  ClienteQueryPort,
  ResumoOperacionalRow,
  SugestaoClienteDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
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
}

describe("ObterResumoSetorSn", () => {
  it("devolve o total de clientes e os 9 cards classificados", async () => {
    const query = new ClienteQueryPortFalso();
    query.linhas = [
      {
        clienteId: "1",
        empresa: "A",
        cnpj: "1",
        documentoObrigatorio: null,
        dasStatus: "enviado",
        temParcelamento: false,
        parcelamentoStatus: null,
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
        temParcelamento: false,
        parcelamentoStatus: null,
        atividadeMes: { industria: true, comercio: false, servico: false },
        responsavelId: null,
        responsavelNome: null,
      },
    ];

    const resultado = await new ObterResumoSetorSn(query).execute();

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.value.totalClientes).toBe(2);
    expect(resultado.value.cards).toHaveLength(9);
    expect(resultado.value.comparativos.das.find((f) => f.id === "enviado")?.quantidade).toBe(1);
    expect(
      resultado.value.comparativos.atividade.find((f) => f.id === "industria")?.quantidade,
    ).toBe(2);
    expect(resultado.value.cards.find((c) => c.id === "das_emitidas")?.quantidade).toBe(1);
    expect(resultado.value.cards.find((c) => c.id === "sem_documento")?.quantidade).toBe(1);
  });

  it("propaga o erro técnico quando a consulta falha", async () => {
    const query = new ClienteQueryPortFalso();
    query.erro = new ForbiddenError("Falha ao listar");

    const resultado = await new ObterResumoSetorSn(query).execute();

    expect(resultado.ok).toBe(false);
  });
});
