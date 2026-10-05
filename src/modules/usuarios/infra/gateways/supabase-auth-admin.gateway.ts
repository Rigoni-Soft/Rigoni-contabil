import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AuthAdminPort,
  ContaCriada,
} from "@/modules/usuarios/application/ports/out/auth-admin.provider";
import { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

class PersistenciaError extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

// Base32 (sem 0/O/1/I) evita ambiguidade quando o Admin repassa a senha por telefone/anotação.
const ALFABETO_SENHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function gerarSenhaProvisoria(): string {
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => ALFABETO_SENHA[b % ALFABETO_SENHA.length]).join("");
}

// Só esta classe usa o client service_role (ver docs/adr/0001) — nunca o client
// autenticado do usuário, que não tem permissão pra criar conta de outra pessoa.
export class SupabaseAuthAdminGateway implements AuthAdminPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async criarConta(email: string): Promise<Result<ContaCriada, AppError>> {
    const senhaProvisoria = gerarSenhaProvisoria();

    const { data, error } = await this.supabaseAdmin.auth.admin.createUser({
      email,
      password: senhaProvisoria,
      email_confirm: true,
    });

    if (error) {
      if (error.code === "email_exists") {
        return err(new ValidationError("E-mail já cadastrado.", { email: ["já cadastrado"] }));
      }
      return err(new PersistenciaError(`Falha ao criar conta: ${error.message}`));
    }
    if (!data.user) return err(new PersistenciaError("Falha ao criar conta: resposta vazia."));

    return ok({ id: data.user.id, senhaProvisoria });
  }

  // ~100 anos: o Auth só aceita duração, não "banido pra sempre".
  async banirConta(id: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: "876000h",
    });
    if (error) return err(new PersistenciaError(`Falha ao bloquear conta: ${error.message}`));
    return ok(undefined);
  }

  async removerConta(id: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.auth.admin.deleteUser(id);
    if (error) return err(new PersistenciaError(`Falha ao remover conta órfã: ${error.message}`));
    return ok(undefined);
  }
}
