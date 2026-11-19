import type { SupabaseClient } from "@supabase/supabase-js";

import type { SalvarContatoDoClienteInput } from "@/modules/clientes/application/ports/in/salvar-contato-do-cliente.provider";
import type { ContatoDoClienteRepository } from "@/modules/clientes/application/ports/out/contato-do-cliente.repository";
import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import { ConsoleRegistroDeErrosGateway } from "@/modules/clientes/infra/gateways/console-registro-de-erros.gateway";
import { contatoParaRpc } from "@/modules/clientes/infra/mappers/contato-row.mapper";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Uma função do banco (`salvar_contato_do_cliente`) cria ou atualiza um contato e confere quem pode.
export class SupabaseContatoDoClienteRepository implements ContatoDoClienteRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly erros: RegistroDeErrosPort = new ConsoleRegistroDeErrosGateway(),
  ) {}

  async salvar(
    clienteId: string,
    contato: SalvarContatoDoClienteInput["contato"],
  ): Promise<Result<string, AppError>> {
    const { data, error } = await this.supabase.rpc("salvar_contato_do_cliente", {
      p_cliente_id: clienteId,
      p_contato: contatoParaRpc(contato),
    });
    if (error) {
      if (error.code === "42501") return err(new ForbiddenError(error.message));
      if (error.code === "23505" || error.code === "22023") {
        return err(new ValidationError(error.message));
      }
      this.erros.registrar("Falha ao salvar o contato do Cliente:", error.message);
      return err(new PersistenciaError("Não foi possível salvar o contato. Tente novamente."));
    }
    return ok(data as string);
  }
}
