import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import type { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import type { AlteracaoContratual } from "@/modules/clientes/domain/value-objects/alteracao-contratual.vo";
import { ConsoleRegistroDeErrosGateway } from "@/modules/clientes/infra/gateways/console-registro-de-erros.gateway";
import { clienteDoRow, type ClienteRow } from "@/modules/clientes/infra/mappers/cliente.mapper";
import {
  contatoParaRpc,
  EMBED_CONTATOS,
} from "@/modules/clientes/infra/mappers/contato-row.mapper";
import { AppError } from "@/shared/errors/app.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { primeiroDiaDoMesAtual } from "@/shared/kernel/mes-atual";
import { erroNumeroRepetidoNoCliente } from "@/shared/kernel/numero-alteracao";
import { err, ok, type Result } from "@/shared/kernel/result";

const SELECT_CLIENTE_BASICO = `
  *,
  cliente_cadastro_operacional_sn(*),
  ${EMBED_CONTATOS},
  cliente_atividades_mensais(*)
`;

class PersistenciaError extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

const ERRO_DATA_FUTURA = "A data da alteração não pode ser futura.";

const semDesfechoConhecido = (status: number) => status === 0 || status >= 502;
const dataFutura = (error: { code?: string; message: string }) =>
  error.code === "23514" && error.message.includes("alteracao_contratual_data_futura");

export class SupabaseClienteRepository implements ClienteRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly erros: RegistroDeErrosPort = new ConsoleRegistroDeErrosGateway(),
  ) {}

  async criar(cliente: Cliente): Promise<Result<void, AppError>> {
    const { error, status } = await this.supabase.rpc("criar_cliente", {
      p_id: cliente.id,
      p_empresa: cliente.empresa,
      p_cnpj: cliente.cnpj.valor,
      p_regime: cliente.regime.valor,
      p_contrato_social_caminho: cliente.contratoSocialCaminho,
      p_email: cliente.email?.valor ?? null,
      p_alteracoes: cliente.alteracoesContratuais.map((alteracao) => ({
        id: crypto.randomUUID(),
        numero: alteracao.numero,
        data: alteracao.data.toISOString().slice(0, 10),
        arquivoCaminho: alteracao.arquivoCaminho,
      })),
    });

    if (error) {
      if (error.code === "23505" && error.message.includes("clientes_cnpj_key")) {
        return err(
          new ValidationError("CNPJ já cadastrado para outro Cliente.", {
            cnpj: ["já cadastrado"],
          }),
        );
      }
      if (dataFutura(error)) return err(new ValidationError(ERRO_DATA_FUTURA));
      this.erros.registrar("Falha ao salvar cliente:", error.message);
      if (semDesfechoConhecido(status)) {
        return err(new ResultadoIncertoError("Não foi possível confirmar o cadastro do Cliente."));
      }
      return err(new PersistenciaError("Não foi possível salvar o Cliente. Tente novamente."));
    }
    return ok(undefined);
  }

  async anexarAlteracaoContratual(
    clienteId: string,
    alteracao: AlteracaoContratual,
  ): Promise<Result<void, AppError>> {
    const { error, status } = await this.supabase.rpc("anexar_alteracao_contratual", {
      p_cliente_id: clienteId,
      p_id: crypto.randomUUID(),
      p_numero: alteracao.numero,
      p_data: alteracao.data.toISOString().slice(0, 10),
      p_caminho: alteracao.arquivoCaminho,
    });

    if (error) {
      if (error.code === "23505") {
        return err(new ValidationError(erroNumeroRepetidoNoCliente(alteracao.numero)));
      }
      if (dataFutura(error)) return err(new ValidationError(ERRO_DATA_FUTURA));
      this.erros.registrar("Falha ao anexar alteração contratual:", error.message);
      if (semDesfechoConhecido(status)) {
        return err(new ResultadoIncertoError("Não foi possível confirmar o anexo da alteração."));
      }
      return err(new PersistenciaError("Não foi possível anexar a alteração. Tente novamente."));
    }
    return ok(undefined);
  }

  async alteracaoContratualGravada(
    clienteId: string,
    numero: number,
    arquivoCaminho: string,
  ): Promise<Result<boolean, AppError>> {
    const { data, error } = await this.supabase
      .from("cliente_alteracoes_contratuais")
      .select("id")
      .eq("cliente_id", clienteId)
      .eq("numero", numero)
      .eq("arquivo_caminho", arquivoCaminho)
      .maybeSingle();
    if (error) {
      this.erros.registrar("Falha ao reconciliar alteração contratual:", error.message);
      return err(new PersistenciaError("Não foi possível confirmar a alteração."));
    }
    return ok(data !== null);
  }

  async buscarPorId(id: string): Promise<Result<Cliente | null, AppError>> {
    const anoMesAtual = primeiroDiaDoMesAtual();

    const { data, error } = await this.supabase
      .from("clientes_basico")
      .select(SELECT_CLIENTE_BASICO)
      .eq("id", id)
      .eq("cliente_atividades_mensais.ano_mes", anoMesAtual)
      .maybeSingle();

    if (error) {
      this.erros.registrar("Falha ao buscar cliente:", error.message);
      return err(new PersistenciaError("Não foi possível carregar o Cliente. Tente novamente."));
    }
    if (!data) return ok(null);
    return ok(clienteDoRow(data as unknown as ClienteRow));
  }

  async atualizarOperacional(cliente: Cliente): Promise<Result<void, AppError>> {
    const anoMes = cliente.atividadeMesAtual
      ? `${cliente.atividadeMesAtual.anoMes}-01`
      : primeiroDiaDoMesAtual();

    const { error } = await this.supabase.rpc("editar_cadastro_operacional_cliente", {
      p_cliente_id: cliente.id,
      p_forma_envio: cliente.formaEnvio.valor,
      p_documento_obrigatorio: cliente.documentoObrigatorio?.valor ?? null,
      p_das_status: cliente.dasStatus?.valor ?? null,
      p_data_envio_das: cliente.dataEnvioDas
        ? cliente.dataEnvioDas.toISOString().slice(0, 10)
        : null,
      p_observacoes_gerais: cliente.observacoesGerais,
      p_contatos: cliente.contatos.map((c) => ({
        ...contatoParaRpc(c),
        id: c.id ?? crypto.randomUUID(),
      })),
      p_ano_mes: anoMes,
      p_industria: cliente.atividadeMesAtual?.industria ?? false,
      p_comercio: cliente.atividadeMesAtual?.comercio ?? false,
      p_servico: cliente.atividadeMesAtual?.servico ?? false,
    });

    if (error) {
      this.erros.registrar("Falha ao atualizar cliente:", error.message);
      return err(
        new PersistenciaError(
          "Não foi possível atualizar o cadastro operacional. Tente novamente.",
        ),
      );
    }
    return ok(undefined);
  }
}
