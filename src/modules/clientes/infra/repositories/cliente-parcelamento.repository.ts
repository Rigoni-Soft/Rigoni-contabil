import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ClienteParcelamentoRepository,
  ParcelamentoSalvo,
} from "@/modules/clientes/application/ports/out/cliente-parcelamento.repository";
import type { ParcelamentoProps } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import {
  parcelamentoDoRow,
  SELECT_PARCELAMENTO,
  type ParcelamentoRow,
} from "@/modules/clientes/infra/mappers/parcelamento-row.mapper";
import { AppError } from "@/shared/errors/app.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { err, ok, type Result } from "@/shared/kernel/result";

class PersistenciaError extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

// Sem resposta (status 0) ou gateway/timeout (502-504): o banco pode ter confirmado a transação.
const semDesfechoConhecido = (status: number) => status === 0 || status >= 502;

export class SupabaseClienteParcelamentoRepository implements ClienteParcelamentoRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listar(clienteId: string): Promise<Result<ParcelamentoSalvo[], AppError>> {
    const { data, error } = await this.supabase
      .from("cliente_parcelamentos")
      .select(SELECT_PARCELAMENTO)
      .eq("cliente_id", clienteId)
      .order("criado_em")
      .order("codigo");
    if (error) {
      console.error("Falha ao listar Parcelamentos:", error.message);
      return err(new PersistenciaError("Não foi possível carregar os Parcelamentos."));
    }

    return ok((data as ParcelamentoRow[]).map(parcelamentoDoRow));
  }

  async salvar(clienteId: string, itens: ParcelamentoProps[]): Promise<Result<void, AppError>> {
    const { error, status } = await this.supabase.rpc("salvar_parcelamentos_cliente", {
      p_cliente_id: clienteId,
      p_itens: itens,
    });
    if (error) {
      console.error("Falha ao salvar Parcelamentos:", error.message);
      if (semDesfechoConhecido(status)) {
        return err(
          new ResultadoIncertoError("Não foi possível confirmar o salvamento dos Parcelamentos."),
        );
      }
      return err(
        new PersistenciaError(
          // Gatilhos do banco recusam com 23514 e mensagem em português, própria para o usuário.
          error.code === "23514"
            ? error.message
            : "Não foi possível salvar os Parcelamentos. Tente novamente.",
        ),
      );
    }
    return ok(undefined);
  }
}
