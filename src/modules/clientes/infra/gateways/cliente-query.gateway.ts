import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CadastroOperacionalClienteDto,
  ClienteQueryPort,
  ResponsavelOpcaoDto,
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

const EMBED_OPERACIONAL =
  "cliente_cadastro_operacional_sn(*, responsavel:perfis!responsavel_id(nome))";

const responsavelDe = (operacional: CadastroOperacionalRow | null) => ({
  responsavelId: operacional?.responsavel_id ?? null,
  responsavelNome: operacional?.responsavel?.nome ?? null,
});

// Lê da view `clientes_basico`, que não tem contrato_social_caminho: a confidencialidade é
// garantida no banco, não só pelo select ou pelo shape do DTO de saída.
const SELECT_CADASTRO_BASICO = `
  id, empresa, cnpj, regime,
  ${EMBED_OPERACIONAL},
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
      ...responsavelDe(operacional),
    });
  }

  async listarResponsaveisElegiveis(): Promise<Result<ResponsavelOpcaoDto[], AppError>> {
    const { data, error } = await this.supabase
      .from("perfis")
      .select("id, nome")
      .eq("papel", "funcionario")
      .eq("setor", "simples_nacional")
      .is("desativado_em", null)
      .order("nome");
    if (error) return err(new ConsultaError(`Erro ao listar Responsáveis: ${error.message}`));
    return ok((data as ResponsavelOpcaoDto[]) ?? []);
  }

  async buscarPorTermo(
    termo: string,
    apenasSnMei: boolean,
  ): Promise<Result<SugestaoClienteDto[], AppError>> {
    // `,`/`()` têm significado especial na sintaxe de filtro `.or()` do
    // PostgREST — sem escapar, um termo com vírgula (ex. "Pão, Quente Ltda")
    // vira duas condições em vez de texto literal. Envolver em aspas duplas
    // (com `"`/`\` escapados) trata o valor inteiro como literal.
    const valor = `%${termo}%`.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    // View `clientes_basico`, não `clientes`: o dashboard é de qualquer Funcionário
    // do setor, e só Admin lê a tabela (contrato social).
    let query = this.supabase.from("clientes_basico").select("id, empresa, cnpj");
    // Só a busca embutida no dashboard do Simples Nacional restringe o Regime — Admin/qualquer
    // setor fora dessa tela busca em qualquer Cliente.
    if (apenasSnMei) query = query.in("regime", ["simples_nacional", "mei"]);
    const { data, error } = await query
      .or(`cnpj.ilike."${valor}",empresa.ilike."${valor}"`)
      .order("empresa")
      .limit(10);

    if (error) return err(new ConsultaError(`Erro ao buscar clientes: ${error.message}`));
    return ok((data as SugestaoClienteDto[]) ?? []);
  }

  async listarResumoOperacional(): Promise<Result<ResumoOperacionalRow[], AppError>> {
    // View `clientes_basico`: o dashboard é de qualquer Funcionário do setor.
    const anoMesAtual = primeiroDiaDoMesAtual();
    const { data, error } = await this.supabase
      .from("clientes_basico")
      .select(`id, empresa, cnpj, ${EMBED_OPERACIONAL}, cliente_atividades_mensais(*)`)
      .eq("cliente_atividades_mensais.ano_mes", anoMesAtual)
      // Mesmo escopo da busca: só Regime com cadastro operacional de
      // verdade (nasce automático só pra Simples Nacional/MEI).
      .in("regime", ["simples_nacional", "mei"]);

    if (error) return err(new ConsultaError(`Erro ao listar resumo operacional: ${error.message}`));

    const linhas = (data ?? []) as unknown as (ClienteBasicoRow & { id: string })[];
    return ok(
      linhas.map((linha) => {
        const operacional = operacionalUnico(linha.cliente_cadastro_operacional_sn);
        const atividade = (linha.cliente_atividades_mensais ?? [])[0];
        return {
          clienteId: linha.id,
          empresa: linha.empresa,
          cnpj: linha.cnpj,
          documentoObrigatorio: operacional?.documento_obrigatorio ?? null,
          dasStatus: operacional?.das_status ?? null,
          temParcelamento: operacional?.tem_parcelamento ?? false,
          parcelamentoStatus: operacional?.parcelamento_status ?? null,
          atividadeMes: {
            industria: atividade?.industria ?? false,
            comercio: atividade?.comercio ?? false,
            servico: atividade?.servico ?? false,
          },
          ...responsavelDe(operacional),
        };
      }),
    );
  }
}
