import type { SupabaseClient } from "@supabase/supabase-js";

import type { ResponsavelClienteRepository } from "@/modules/clientes/application/ports/out/responsavel-cliente.repository";
import { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

class PersistenciaError extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

// Só mexe em responsavel_id; o banco (trigger + RLS, migration #65) é a última
// barreira — Funcionário nem chega a gravar por este caminho.
export class SupabaseResponsavelClienteGateway implements ResponsavelClienteRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async atribuir(clienteId: string, responsavelId: string | null): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase
      .from("cliente_cadastro_operacional_sn")
      .update({ responsavel_id: responsavelId })
      .eq("cliente_id", clienteId)
      .select("cliente_id");

    if (error) {
      if (error.code === "42501") return err(new ForbiddenError(error.message));
      console.error("Falha ao atribuir Responsável:", error.message);
      return err(
        new PersistenciaError("Não foi possível atribuir o Responsável. Tente novamente."),
      );
    }
    // RLS filtra silenciosamente: 0 linhas = Cliente sem cadastro operacional ou invisível.
    if (!data?.length) {
      return err(new ForbiddenError("Cliente sem cadastro operacional do Simples Nacional."));
    }
    return ok(undefined);
  }
}
