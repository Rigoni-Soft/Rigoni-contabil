import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AuthAdminPort,
  ContaCriada,
} from "@/modules/usuarios/application/ports/out/auth-admin.provider";
import type { AppError } from "@/shared/errors/app.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const BAN_DURATION_INDEFINIDO = "876000h";

const ALFABETO_SENHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function gerarSenhaProvisoria(): string {
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => ALFABETO_SENHA[b % ALFABETO_SENHA.length]).join("");
}

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

  async banirConta(id: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: BAN_DURATION_INDEFINIDO,
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
