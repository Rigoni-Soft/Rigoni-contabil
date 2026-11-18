import type { SupabaseClient } from "@supabase/supabase-js";

import type { AvatarMarcaPort } from "@/modules/usuarios/application/ports/out/avatar-marca.provider";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Só um client service_role grava a coluna: o gatilho `perfis_proteger_avatar` nega qualquer sessão
// de usuário (ADR 0008).
export class SupabaseAvatarMarcaGateway implements AvatarMarcaPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async definir(usuarioId: UsuarioId, em: Date | null): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin
      .from("perfis")
      .update({ avatar_atualizado_em: em ? em.toISOString() : null })
      .eq("id", usuarioId);
    if (error) {
      return err(new PersistenciaError(`Falha ao gravar a marca da foto: ${error.message}`));
    }
    return ok(undefined);
  }
}
