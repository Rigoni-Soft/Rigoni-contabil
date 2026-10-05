import type { SupabaseClient } from "@supabase/supabase-js";

import type { DesativacaoPort } from "@/modules/usuarios/application/ports/out/desativacao.provider";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Só um client service_role chama a RPC (ver docs/adr/0001): ela não aceita
// EXECUTE de `authenticated`/`anon`, então a checagem "só Admin" fica no caso de uso.
export class SupabaseDesativacaoGateway implements DesativacaoPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async desativar(alvoId: UsuarioId, atorId: UsuarioId): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.rpc("desativar_usuario", {
      alvo_id: alvoId,
      ator_id: atorId,
    });
    if (error) return err(new PersistenciaError(`Falha em desativar_usuario: ${error.message}`));
    return ok(undefined);
  }
}
