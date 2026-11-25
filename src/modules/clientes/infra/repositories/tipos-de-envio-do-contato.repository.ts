import type { SupabaseClient } from "@supabase/supabase-js";

import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import type { TiposDeEnvioDoContatoRepository } from "@/modules/clientes/application/ports/out/tipos-de-envio-do-contato.repository";
import { ConsoleRegistroDeErrosGateway } from "@/modules/clientes/infra/gateways/console-registro-de-erros.gateway";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { ValidationError } from "@/shared/errors/validation.error";
import type { FormaEnvioValor } from "@/shared/kernel/forma-envio";
import { err, ok, type Result } from "@/shared/kernel/result";

export class SupabaseTiposDeEnvioDoContatoRepository implements TiposDeEnvioDoContatoRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly erros: RegistroDeErrosPort = new ConsoleRegistroDeErrosGateway(),
  ) {}

  async definir(
    clienteId: string,
    contatoId: string,
    tipos: string[],
    canal?: FormaEnvioValor,
  ): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.rpc("definir_tipos_de_envio_do_contato", {
      p_cliente_id: clienteId,
      p_contato_id: contatoId,
      p_tipos: tipos,
      p_canal: canal ?? null,
    });
    if (!error) return ok(undefined);
    if (error.code === "42501") {
      return err(new ForbiddenError("Sem permissão para definir os envios deste Cliente."));
    }
    if (error.code === "22023" && error.message.includes("Escolha o canal")) {
      return err(new ValidationError("Escolha por onde enviar ao contato."));
    }
    if (error.code === "22023" || error.code === "23503") {
      return err(new ValidationError("Contato ou tipo de envio inválido. Atualize a página."));
    }
    this.erros.registrar("Falha ao definir os tipos de envio do contato:", error.message);
    return err(new PersistenciaError("Não foi possível salvar os envios. Tente novamente."));
  }
}
