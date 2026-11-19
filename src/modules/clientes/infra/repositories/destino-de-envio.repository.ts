import type { SupabaseClient } from "@supabase/supabase-js";

import type { DestinoDeEnvioRepository } from "@/modules/clientes/application/ports/out/destino-de-envio.repository";
import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import type { DestinoDeEnvio } from "@/modules/clientes/domain/value-objects/destino-de-envio.vo";
import { ConsoleRegistroDeErrosGateway } from "@/modules/clientes/infra/gateways/console-registro-de-erros.gateway";
import { contatoParaRpc } from "@/modules/clientes/infra/mappers/contato-row.mapper";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const MENSAGEM_REPETIDO = "Este contato já está definido para este tipo de envio.";
const MENSAGEM_CANAL = "O contato não tem o canal escolhido. Atualize a página e confira o contato.";
const MENSAGEM_SEM_PERMISSAO = "Sem permissão para definir os destinos de envio deste Cliente.";

// `salvar_destino_de_envio` grava o Destino do Setor de quem chama (e o Contato novo, na mesma
// transação); o Setor e a permissão vêm do banco (RLS), nunca do chamador.
export class SupabaseDestinoDeEnvioRepository implements DestinoDeEnvioRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly erros: RegistroDeErrosPort = new ConsoleRegistroDeErrosGateway(),
  ) {}

  async definir(
    clienteId: string,
    destino: DestinoDeEnvio,
  ): Promise<Result<{ destinoId: string; contatoId: string }, AppError>> {
    const { contato } = destino;
    const { data, error } = await this.supabase.rpc("salvar_destino_de_envio", {
      p_cliente_id: clienteId,
      p_contato_id: "id" in contato ? contato.id : null,
      p_contato: "novo" in contato ? contatoParaRpc(contato.novo) : null,
      p_tipo: destino.tipo,
      p_canal: destino.canal,
    });
    if (error) {
      if (error.code === "42501") return err(new ForbiddenError(MENSAGEM_SEM_PERMISSAO));
      // Número ou e-mail já do Cliente (o trigger traz o contato existente e o `hint`; a do índice
      // único traz constraint e valores) ou o mesmo Destino repetido: texto fixo para a segunda.
      if (error.code === "23505") {
        return err(new ValidationError(error.hint ? error.message : MENSAGEM_REPETIDO));
      }
      if (error.code === "22023") return err(new ValidationError(error.message));
      if (error.code === "23514") return err(new ValidationError(MENSAGEM_CANAL));
      this.erros.registrar("Falha ao definir o destino de envio:", error.message);
      return err(new PersistenciaError("Não foi possível salvar o destino. Tente novamente."));
    }
    const ids = data as { destino_id: string; contato_id: string };
    return ok({ destinoId: ids.destino_id, contatoId: ids.contato_id });
  }

  async remover(destinoId: string): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase
      .from("destinos_de_envio")
      .delete()
      .eq("id", destinoId)
      .select("id");
    if (error) {
      this.erros.registrar("Falha ao remover o destino de envio:", error.message);
      return err(new PersistenciaError("Não foi possível remover o destino. Tente novamente."));
    }
    // A RLS esconde o que o ator não gere: nenhuma linha apagada é recusa (ou destino já removido).
    if (!data?.length) return err(new ForbiddenError("Destino não encontrado ou sem permissão."));
    return ok(undefined);
  }
}
