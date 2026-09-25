import type { SupabaseClient } from "@supabase/supabase-js";

import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Falha técnica (Supabase indisponível, timeout, erro interno) — nunca deve
// virar "credenciais inválidas" pro usuário, senão esconde uma indisponibilidade
// real atrás de uma mensagem que sugere erro de digitação.
class AutenticacaoIndisponivelError extends AppError {
  readonly code = "AUTENTICACAO_INDISPONIVEL";
}

// Códigos do GoTrue que significam, de fato, credencial errada — qualquer outro
// código (ou nenhum, típico de falha de rede) é tratado como falha técnica.
const CODIGOS_CREDENCIAL_INVALIDA = new Set(["invalid_credentials"]);

export class SupabaseSessaoGateway implements SessaoPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async autenticar(email: string, senha: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password: senha });
    if (!error) return ok(undefined);

    if (error.code && CODIGOS_CREDENCIAL_INVALIDA.has(error.code)) {
      return err(new ForbiddenError("E-mail ou senha inválidos."));
    }
    return err(new AutenticacaoIndisponivelError(`Falha ao autenticar: ${error.message}`));
  }

  async encerrar(): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.auth.signOut();
    if (error)
      return err(new AutenticacaoIndisponivelError(`Falha ao encerrar sessão: ${error.message}`));
    return ok(undefined);
  }

  async usuarioAtualId(): Promise<UsuarioId | null> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    return (user?.id as UsuarioId | undefined) ?? null;
  }
}
