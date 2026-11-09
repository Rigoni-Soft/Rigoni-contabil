import type { SupabaseClient } from "@supabase/supabase-js";

import type { CadastroRhRepository } from "@/modules/clientes/application/ports/out/cadastro-rh.repository";
import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import { ConsoleRegistroDeErrosGateway } from "@/modules/clientes/infra/gateways/console-registro-de-erros.gateway";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Uma função do banco (`editar_cadastro_rh_cliente`) grava observações e contatos na mesma transação e
// confere quem pode por Cliente; ela só toca no que é do RH ou compartilhado.
export class SupabaseCadastroRhRepository implements CadastroRhRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly erros: RegistroDeErrosPort = new ConsoleRegistroDeErrosGateway(),
  ) {}

  async atualizar(
    clienteId: string,
    observacoes: string,
    contatos: { id?: string; nome: string; telefone: string; padrao: boolean }[],
  ): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.rpc("editar_cadastro_rh_cliente", {
      p_cliente_id: clienteId,
      p_observacoes: observacoes,
      p_contatos: contatos.map((c) => ({ ...c, id: c.id ?? crypto.randomUUID() })),
    });
    if (error) {
      if (error.code === "42501") {
        return err(new ForbiddenError("Você não é o Responsável do RH deste cliente."));
      }
      this.erros.registrar("Falha ao atualizar o cadastro do RH:", error.message);
      return err(
        new PersistenciaError("Não foi possível salvar o cadastro do RH. Tente novamente."),
      );
    }
    return ok(undefined);
  }
}
