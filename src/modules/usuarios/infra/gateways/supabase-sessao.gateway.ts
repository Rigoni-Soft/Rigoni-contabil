import type { SupabaseClient } from "@supabase/supabase-js";

import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class SupabaseSessaoGateway implements SessaoPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async autenticar(email: string, senha: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password: senha });
    if (error) return err(new ForbiddenError("E-mail ou senha inválidos."));
    return ok(undefined);
  }

  async encerrar(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  async usuarioAtualId(): Promise<UsuarioId | null> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    return (user?.id as UsuarioId | undefined) ?? null;
  }
}
