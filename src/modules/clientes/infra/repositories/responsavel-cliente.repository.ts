import type { SupabaseClient } from "@supabase/supabase-js";

import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import type { ResponsavelClienteRepository } from "@/modules/clientes/application/ports/out/responsavel-cliente.repository";
import { ConsoleRegistroDeErrosGateway } from "@/modules/clientes/infra/gateways/console-registro-de-erros.gateway";
import { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

class PersistenciaError extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

// Só mexe no Responsável; o banco (trigger + RLS) é a última barreira — Funcionário nem chega a
// gravar por este caminho. Todo Setor guarda em `cliente_responsaveis` (um por Cliente e Setor).
export class SupabaseResponsavelClienteRepository implements ResponsavelClienteRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly erros: RegistroDeErrosPort = new ConsoleRegistroDeErrosGateway(),
  ) {}

  async atribuir(
    clienteId: string,
    setor: SetorSlug,
    responsavelId: string | null,
  ): Promise<Result<void, AppError>> {
    const { error } =
      responsavelId === null
        ? await this.supabase
            .from("cliente_responsaveis")
            .delete()
            .eq("cliente_id", clienteId)
            .eq("setor", setor)
        : await this.supabase
            .from("cliente_responsaveis")
            .upsert(
              { cliente_id: clienteId, setor, responsavel_id: responsavelId },
              { onConflict: "cliente_id,setor" },
            );
    if (!error) return ok(undefined);
    if (error.code === "42501") return err(new ForbiddenError(error.message));
    // O gatilho recusa quem não é Funcionário ativo do Setor.
    if (error.code === "23514") {
      return err(
        new ValidationError("O Responsável deve ser Funcionário ativo do Setor.", {
          responsavelId: ["Funcionário inválido"],
        }),
      );
    }
    this.erros.registrar("Falha ao atribuir Responsável:", error.message);
    return err(new PersistenciaError("Não foi possível atribuir o Responsável. Tente novamente."));
  }
}
