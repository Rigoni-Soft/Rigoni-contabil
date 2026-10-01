import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CadastroOperacionalClienteDto,
  ClienteQueryPort,
  ResumoOperacionalRow,
  SugestaoClienteDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import {
  operacionalUnico,
  type CadastroOperacionalRow,
} from "@/modules/clientes/infra/mappers/cadastro-operacional-row.mapper";
import { AppError } from "@/shared/errors/app.error";
import { primeiroDiaDoMesAtual } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";

class ConsultaError extends AppError {
  readonly code = "CONSULTA_ERROR";
}

type ContatoRow = { id: string; nome: string; telefone: string; padrao: boolean };
type AtividadeMensalRow = { industria: boolean; comercio: boolean; servico: boolean };

type ClienteBasicoRow = {
  id: string;
  empresa: string;
  cnpj: string;
  regime: string;
  cliente_cadastro_operacional_sn: CadastroOperacionalRow | CadastroOperacionalRow[] | null;
  cliente_contatos: ContatoRow[] | null;
  cliente_atividades_mensais: AtividadeMensalRow[] | null;
};

// Lê da view `clientes_basico`, que não tem contrato_social_caminho: a
// confidencialidade é garantida no banco (PR #69), não só pelo select ou pelo
// shape do DTO de saída.
const SELECT_CADASTRO_BASICO = `
  id, empresa, cnpj, regime,
  cliente_cadastro_operacional_sn(*),
  cliente_contatos(*),
  cliente_atividades_mensais(*)
`;

export class SupabaseClienteQueryGateway implements ClienteQueryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async buscarCadastroOperacional(
    clienteId: string,
  ): Promise<Result<CadastroOperacionalClienteDto | null, AppError>> {
    const anoMesAtual = primeiroDiaDoMesAtual();

    const { data, error } = await this.supabase
      .from("clientes_basico")
      .select(SELECT_CADASTRO_BASICO)
      .eq("id", clienteId)
      .eq("cliente_atividades_mensais.ano_mes", anoMesAtual)
      .maybeSingle();

    if (error)
      return err(new ConsultaError(`Erro ao buscar cadastro operacional: ${error.message}`));
    if (!data) return ok(null);

    const row = data as unknown as ClienteBasicoRow;
    const operacional = operacionalUnico(row.cliente_cadastro_operacional_sn);
    const atividade = (row.cliente_atividades_mensais ?? [])[0] ?? null;

    return ok({
      id: row.id,
      empresa: row.empresa,
      cnpj: row.cnpj,
      regime: row.regime,
      formaEnvio: operacional?.forma_envio ?? "whatsapp",
      contatos: (row.cliente_contatos ?? []).map((contato) => ({
        id: contato.id,
        nome: contato.nome,
        telefone: contato.telefone,
        padrao: contato.padrao,
      })),
      documentoObrigatorio: operacional?.documento_obrigatorio ?? null,
      dasStatus: operacional?.das_status ?? null,
      dataEnvioDas: operacional?.data_envio_das ?? null,
      temParcelamento: operacional?.tem_parcelamento ?? false,
      parcelamentoStatus: operacional?.parcelamento_status ?? null,
      observacoesGerais: operacional?.observacoes_gerais ?? "",
      atividadeMes: {
        industria: atividade?.industria ?? false,
        comercio: atividade?.comercio ?? false,
        servico: atividade?.servico ?? false,
      },
    });
  }

  async buscarPorTermo(termo: string): Promise<Result<SugestaoClienteDto[], AppError>> {
    // `,`/`()` têm significado especial na sintaxe de filtro `.or()` do
    // PostgREST — sem escapar, um termo com vírgula (ex. "Pão, Quente Ltda")
    // vira duas condições em vez de texto literal. Envolver em aspas duplas
    // (com `"`/`\` escapados) trata o valor inteiro como literal.
    const valor = `%${termo}%`.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    // View `clientes_basico`, não `clientes`: o dashboard é de qualquer Funcionário
    // do setor, e só Admin lê a tabela (devolutiva PR #69, contrato social).
    const { data, error } = await this.supabase
      .from("clientes_basico")
      .select("id, empresa, cnpj")
      // Esta busca é a seção "Buscar cliente" do dashboard do setor Simples
      // Nacional (#35/#36) — só Regime Simples Nacional/MEI tem cadastro
      // operacional de verdade (nasce automático só pra esses dois no #34);
      // Presumido/Real não aparecem aqui, mesmo que o cliente exista.
      .in("regime", ["simples_nacional", "mei"])
      .or(`cnpj.ilike."${valor}",empresa.ilike."${valor}"`)
      .order("empresa")
      .limit(10);

    if (error) return err(new ConsultaError(`Erro ao buscar clientes: ${error.message}`));
    return ok((data as SugestaoClienteDto[]) ?? []);
  }

  async listarResumoOperacional(): Promise<Result<ResumoOperacionalRow[], AppError>> {
    const { data, error } = await this.supabase
      .from("clientes")
      .select("id, empresa, cnpj, cliente_cadastro_operacional_sn(*)")
      // Mesmo escopo da busca (#35): só Regime com cadastro operacional de
      // verdade (nasce automático só pra Simples Nacional/MEI, #34).
      .in("regime", ["simples_nacional", "mei"]);

    if (error) return err(new ConsultaError(`Erro ao listar resumo operacional: ${error.message}`));

    const linhas = (data ?? []) as unknown as (ClienteBasicoRow & { id: string })[];
    return ok(
      linhas.map((linha) => {
        const operacional = operacionalUnico(linha.cliente_cadastro_operacional_sn);
        return {
          clienteId: linha.id,
          empresa: linha.empresa,
          cnpj: linha.cnpj,
          documentoObrigatorio: operacional?.documento_obrigatorio ?? null,
          dasStatus: operacional?.das_status ?? null,
          temParcelamento: operacional?.tem_parcelamento ?? false,
          parcelamentoStatus: operacional?.parcelamento_status ?? null,
        };
      }),
    );
  }
}
