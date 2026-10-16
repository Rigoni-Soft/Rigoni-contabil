import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ORIENTACAO_SETOR_COM_LIDER,
  type AlteracaoPapelPort,
  type PapelAlteravel,
} from "@/modules/usuarios/application/ports/out/alteracao-papel.provider";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Só um client service_role chama a RPC (ver docs/adr/0001): ela não aceita
// EXECUTE de `authenticated`/`anon`, então a checagem "só Admin" fica no caso de uso.
export class SupabaseAlteracaoPapelGateway implements AlteracaoPapelPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async alterar(
    alvoId: UsuarioId,
    atorId: UsuarioId,
    papel: PapelAlteravel,
  ): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.rpc("alterar_papel_usuario", {
      alvo_id: alvoId,
      ator_id: atorId,
      novo_papel: papel,
    });
    if (error?.message.includes("setor_com_lider")) {
      return err(new ValidationError(`O setor já tem Líder ativo. ${ORIENTACAO_SETOR_COM_LIDER}`));
    }
    if (error?.message.includes("responsavel_com_clientes")) {
      return err(
        new ValidationError(
          "O Funcionário é Responsável por Clientes. Redistribua os Clientes dele antes de promovê-lo.",
        ),
      );
    }
    if (error)
      return err(new PersistenciaError(`Falha em alterar_papel_usuario: ${error.message}`));
    return ok(undefined);
  }
}
