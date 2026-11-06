import type { SupabaseClient } from "@supabase/supabase-js";

import type { RegistroDeErrosPort } from "@/modules/usuarios/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { ConsoleRegistroDeErrosGateway } from "@/modules/usuarios/infra/gateways/console-registro-de-erros.gateway";
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

// O Auth rejeita updateUser() com esse código tanto no reenvio legítimo (updateUser() já teve
// sucesso numa tentativa anterior, só a finalização falhou) quanto quando o usuário manda a própria
// senha provisória como "nova senha". Este gateway não distingue os dois — quem sabe é
// TrocarSenha.execute(), que conhece precisaTrocarSenha() do perfil. Por isso o código vira um erro
// próprio em vez de ok() cego; a decisão fica na camada de aplicação.
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
    // Detalhe fica só no log do servidor: login.actions.ts devolve error.message
    // direto pro navegador, então a mensagem do AppError nunca pode carregar o
    // texto cru do Supabase (poderia expor detalhe interno pra um visitante
    // não autenticado).
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
