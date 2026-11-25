import type { SupabaseClient } from "@supabase/supabase-js";

import type { RegistroDeErrosPort } from "@/modules/usuarios/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { ConsoleRegistroDeErrosGateway } from "@/modules/usuarios/infra/gateways/console-registro-de-erros.gateway";
import { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

class AutenticacaoIndisponivelError extends AppError {
  readonly code = "AUTENTICACAO_INDISPONIVEL";
}

const CODIGOS_CREDENCIAL_INVALIDA = new Set(["invalid_credentials"]);

const CODIGO_SENHA_JA_DEFINIDA = "same_password";

export class SenhaJaDefinidaError extends AppError {
  readonly code = "SENHA_JA_DEFINIDA";
}

export class SupabaseSessaoGateway implements SessaoPort {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly erros: RegistroDeErrosPort = new ConsoleRegistroDeErrosGateway(),
  ) {}

  async autenticar(email: string, senha: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password: senha });
    if (!error) return ok(undefined);

    if (error.code && CODIGOS_CREDENCIAL_INVALIDA.has(error.code)) {
      return err(new ForbiddenError("E-mail ou senha inválidos."));
    }
    if (error.code === "user_banned") return err(new ForbiddenError("Conta desativada."));
    this.erros.registrar("Falha técnica ao autenticar no Supabase:", error.message);
    return err(
      new AutenticacaoIndisponivelError("Não foi possível autenticar agora. Tente novamente."),
    );
  }

  async encerrar(): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      this.erros.registrar("Falha técnica ao encerrar sessão no Supabase:", error.message);
      return err(new AutenticacaoIndisponivelError("Não foi possível encerrar a sessão agora."));
    }
    return ok(undefined);
  }

  async usuarioAtualId(): Promise<UsuarioId | null> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    return (user?.id as UsuarioId | undefined) ?? null;
  }

  async trocarSenha(novaSenha: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      if (error.code === CODIGO_SENHA_JA_DEFINIDA) {
        return err(new SenhaJaDefinidaError("A nova senha é igual à senha atual."));
      }
      this.erros.registrar("Falha técnica ao trocar senha no Supabase:", error.message);
      return err(new AutenticacaoIndisponivelError("Não foi possível trocar a senha agora."));
    }
    return ok(undefined);
  }
}
