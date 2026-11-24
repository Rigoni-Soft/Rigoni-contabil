import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  MOTIVOS_DE_DESTINO_INVALIDO,
  type DestinoDeEnvio,
  type DestinosDeEnvioPort,
} from "@/modules/atendimento/application/ports/out/destinos-de-envio.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { FORMAS_ENVIO } from "@/shared/kernel/forma-envio";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";
import type { TipoDeEnvio } from "@/shared/kernel/tipo-de-envio";

const linhasSchema = z.array(
  z.object({
    contato_nome: z.string(),
    telefone_envio: z.string().nullable(),
    email: z.string().nullable(),
    canal: z.enum(FORMAS_ENVIO),
    ultima_mensagem_do_contato_em: z.string().nullable(),
    motivo: z.enum(MOTIVOS_DE_DESTINO_INVALIDO).nullable(),
  }),
);

export class SupabaseDestinosDeEnvioGateway implements DestinosDeEnvioPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async resolver(
    clienteId: string,
    setor: SetorSlug,
    tipo: TipoDeEnvio,
  ): Promise<Result<DestinoDeEnvio[], AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("destinos_de_envio_do_job", {
      p_cliente_id: clienteId,
      p_setor: setor,
      p_tipo: tipo,
    });
    const linhas = linhasSchema.safeParse(data);
    if (error || !linhas.success) {
      return err(new ServicoExternoError("Falha ao ler os Destinos de envio do Cliente."));
    }
    return ok(
      linhas.data.map((l) => ({
        contatoNome: l.contato_nome,
        telefone: l.telefone_envio,
        email: l.email,
        canal: l.canal,
        ultimaMensagemDoContatoEm: l.ultima_mensagem_do_contato_em
          ? new Date(l.ultima_mensagem_do_contato_em)
          : null,
        motivoInvalido: l.motivo,
      })),
    );
  }
}
