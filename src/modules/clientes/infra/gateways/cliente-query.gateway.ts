import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CadastroOperacionalClienteDto,
  ClienteQueryPort,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

class ConsultaError extends AppError {
  readonly code = "CONSULTA_ERROR";
}

type ContatoRow = { id: string; nome: string; telefone: string; padrao: boolean };
type AtividadeMensalRow = { industria: boolean; comercio: boolean; servico: boolean };
type CadastroOperacionalRow = {
  forma_envio: string;
  documento_obrigatorio: string | null;
  das_status: string | null;
  data_envio_das: string | null;
  tem_parcelamento: boolean;
  parcelamento_status: string | null;
  observacoes_gerais: string;
};

type ClienteBasicoRow = {
  id: string;
  empresa: string;
  cnpj: string;
  regime: string;
  cliente_cadastro_operacional_sn: CadastroOperacionalRow | CadastroOperacionalRow[] | null;
  cliente_contatos: ContatoRow[] | null;
  cliente_atividades_mensais: AtividadeMensalRow[] | null;
};

function operacionalUnico(
  valor: CadastroOperacionalRow | CadastroOperacionalRow[] | null,
): CadastroOperacionalRow | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

// Select explícito: nunca inclui contrato_social_caminho/alterações — a
// confidencialidade desta consulta é garantida pelas colunas pedidas, não só
// pelo shape do DTO de saída (defesa em profundidade dupla).
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
    const anoMesAtual = `${new Date().toISOString().slice(0, 7)}-01`;

    const { data, error } = await this.supabase
      .from("clientes")
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
}
