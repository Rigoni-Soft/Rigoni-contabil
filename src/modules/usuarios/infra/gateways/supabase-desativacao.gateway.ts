import type { SupabaseClient } from "@supabase/supabase-js";

import type { DesativacaoPort } from "@/modules/usuarios/application/ports/out/desativacao.provider";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { err, ok, type Result } from "@/shared/kernel/result";

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

  async registrarBloqueio(alvoId: UsuarioId): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin
      .from("perfis")
      .update({ banido_em: new Date().toISOString() })
      .eq("id", alvoId)
      .is("banido_em", null);
    if (error) return err(new PersistenciaError(`Falha ao registrar bloqueio: ${error.message}`));
    return ok(undefined);
  }
}
