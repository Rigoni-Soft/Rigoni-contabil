import type { SupabaseClient } from "@supabase/supabase-js";

import type { FinalizarTrocaSenhaPort } from "@/modules/usuarios/application/ports/out/finalizar-troca-senha.provider";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Só esta classe usa o client service_role (ver docs/adr/0001) pra finalizar a troca — as RPCs não
// aceitam EXECUTE de `authenticated`/`anon`, então só um client service_role consegue chamá-las.
export class SupabaseFinalizarTrocaSenhaGateway implements FinalizarTrocaSenhaPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  registrarAuthAlterado(usuarioId: UsuarioId): Promise<Result<void, AppError>> {
    return this.chamar("registrar_auth_senha_alterada", usuarioId);
  }

  finalizar(usuarioId: UsuarioId): Promise<Result<void, AppError>> {
    return this.chamar("finalizar_troca_senha", usuarioId);
  }

  private async chamar(rpc: string, usuarioId: UsuarioId): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.rpc(rpc, { usuario_id: usuarioId });
    if (error) return err(new PersistenciaError(`Falha em ${rpc}: ${error.message}`));
    return ok(undefined);
  }
}
