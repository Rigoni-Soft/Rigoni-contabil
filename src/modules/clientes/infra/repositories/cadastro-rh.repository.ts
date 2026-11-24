import type { SupabaseClient } from "@supabase/supabase-js";

import type { EditarCadastroRhClienteInput } from "@/modules/clientes/application/ports/in/editar-cadastro-rh-cliente.provider";
import type { CadastroRhRepository } from "@/modules/clientes/application/ports/out/cadastro-rh.repository";
import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import { ConsoleRegistroDeErrosGateway } from "@/modules/clientes/infra/gateways/console-registro-de-erros.gateway";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const PG_SEM_PERMISSAO = "42501";
const PG_PARAMETRO_INVALIDO = "22023";

export class SupabaseCadastroRhRepository implements CadastroRhRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly erros: RegistroDeErrosPort = new ConsoleRegistroDeErrosGateway(),
  ) {}

  async atualizar(
    clienteId: string,
    observacoes: string,
    contatos: EditarCadastroRhClienteInput["contatos"] | undefined,
  ): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.rpc("editar_cadastro_rh_cliente", {
      p_cliente_id: clienteId,
      p_observacoes: observacoes,
      p_contatos: contatos ?? null,
    });
    if (error) {
      if (error.code === PG_SEM_PERMISSAO) {
        return err(new ForbiddenError("Você não é o Responsável do RH deste cliente."));
      }
      if (error.code === PG_PARAMETRO_INVALIDO) return err(new ValidationError(error.message));
      this.erros.registrar("Falha ao atualizar o cadastro do RH:", error.message);
      return err(
        new PersistenciaError("Não foi possível salvar o cadastro do RH. Tente novamente."),
      );
    }
    return ok(undefined);
  }
}
