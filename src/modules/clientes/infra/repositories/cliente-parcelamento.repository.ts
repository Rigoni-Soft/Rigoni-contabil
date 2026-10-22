import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ClienteParcelamentoRepository,
  ParcelamentoGravar,
  ParcelamentoSalvo,
} from "@/modules/clientes/application/ports/out/cliente-parcelamento.repository";
import {
  parcelamentoDoRow,
  type ParcelamentoRow,
} from "@/modules/clientes/infra/mappers/parcelamento-row.mapper";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

class PersistenciaError extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

// Gatilhos do banco recusam com 23514 e mensagem em português, própria para o usuário.
const mensagemDe = (error: { code?: string; message: string }, padrao: string) =>
  error.code === "23514" ? error.message : padrao;

export class SupabaseClienteParcelamentoRepository implements ClienteParcelamentoRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listar(clienteId: string): Promise<Result<ParcelamentoSalvo[], AppError>> {
    const { data, error } = await this.supabase
      .from("cliente_parcelamentos")
      .select("*, cliente_parcelamento_envios(parcela)")
      .eq("cliente_id", clienteId)
      .order("criado_em")
      .order("codigo");
    if (error) {
      console.error("Falha ao listar Parcelamentos:", error.message);
      return err(new PersistenciaError("Não foi possível carregar os Parcelamentos."));
    }

    return ok((data as ParcelamentoRow[]).map(parcelamentoDoRow));
  }

  async salvar(clienteId: string, itens: ParcelamentoGravar[]): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.rpc("salvar_parcelamentos_cliente", {
      p_cliente_id: clienteId,
      p_itens: itens,
    });
    if (error) {
      console.error("Falha ao salvar Parcelamentos:", error.message);
      return err(
        new PersistenciaError(
          mensagemDe(error, "Não foi possível salvar os Parcelamentos. Tente novamente."),
        ),
      );
    }
    return ok(undefined);
  }
}
