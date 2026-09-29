import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import { clienteDoRow, type ClienteRow } from "@/modules/clientes/infra/mappers/cliente.mapper";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const SELECT_CLIENTE_COMPLETO = `
  *,
  cliente_alteracoes_contratuais(*),
  cliente_cadastro_operacional_sn(*),
  cliente_contatos(*),
  cliente_atividades_mensais(*)
`;

class PersistenciaError extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

export class SupabaseClienteRepository implements ClienteRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  // Cliente e suas Alterações contratuais são o mesmo agregado (raiz + entidades
  // filhas, arquitetura.md seção 3.5): gravados juntos via RPC transacional
  // (`criar_cliente`, migration deste ticket) em vez de dois inserts soltos.
  async criar(cliente: Cliente): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.rpc("criar_cliente", {
      p_id: cliente.id,
      p_empresa: cliente.empresa,
      p_cnpj: cliente.cnpj.valor,
      p_regime: cliente.regime.valor,
      p_contrato_social_caminho: cliente.contratoSocialCaminho,
      p_alteracoes: cliente.alteracoesContratuais.map((alteracao) => ({
        id: crypto.randomUUID(),
        data: alteracao.data.toISOString().slice(0, 10),
        arquivoCaminho: alteracao.arquivoCaminho,
      })),
    });

    if (error) return err(new PersistenciaError(`Falha ao salvar cliente: ${error.message}`));
    return ok(undefined);
  }

  async buscarPorId(id: string): Promise<Result<Cliente | null, AppError>> {
    const anoMesAtual = `${new Date().toISOString().slice(0, 7)}-01`;

    const { data, error } = await this.supabase
      .from("clientes")
      .select(SELECT_CLIENTE_COMPLETO)
      .eq("id", id)
      .eq("cliente_atividades_mensais.ano_mes", anoMesAtual)
      .maybeSingle();

    if (error) return err(new PersistenciaError(`Falha ao buscar cliente: ${error.message}`));
    if (!data) return ok(null);
    return ok(clienteDoRow(data as unknown as ClienteRow));
  }

  // cliente_cadastro_operacional_sn + cliente_contatos + cliente_atividades_mensais
  // são extensão do mesmo agregado Cliente (arquitetura.md seção 3.5): gravados
  // juntos via RPC transacional (`editar_cadastro_operacional_cliente`).
  async atualizarOperacional(cliente: Cliente): Promise<Result<void, AppError>> {
    const anoMes = cliente.atividadeMesAtual
      ? `${cliente.atividadeMesAtual.anoMes}-01`
      : `${new Date().toISOString().slice(0, 7)}-01`;

    const { error } = await this.supabase.rpc("editar_cadastro_operacional_cliente", {
      p_cliente_id: cliente.id,
      p_forma_envio: cliente.formaEnvio.valor,
      p_documento_obrigatorio: cliente.documentoObrigatorio?.valor ?? null,
      p_das_status: cliente.dasStatus?.valor ?? null,
      p_data_envio_das: cliente.dataEnvioDas
        ? cliente.dataEnvioDas.toISOString().slice(0, 10)
        : null,
      p_tem_parcelamento: cliente.temParcelamento,
      p_parcelamento_status: cliente.parcelamentoStatus?.valor ?? null,
      p_observacoes_gerais: cliente.observacoesGerais,
      p_contatos: cliente.contatos.map((contato) => ({
        id: contato.id ?? crypto.randomUUID(),
        nome: contato.nome,
        telefone: contato.telefone,
        padrao: contato.padrao,
      })),
      p_ano_mes: anoMes,
      p_industria: cliente.atividadeMesAtual?.industria ?? false,
      p_comercio: cliente.atividadeMesAtual?.comercio ?? false,
      p_servico: cliente.atividadeMesAtual?.servico ?? false,
    });

    if (error) return err(new PersistenciaError(`Falha ao atualizar cliente: ${error.message}`));
    return ok(undefined);
  }
}
