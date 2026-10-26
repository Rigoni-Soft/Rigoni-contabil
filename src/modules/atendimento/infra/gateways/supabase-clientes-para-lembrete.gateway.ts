import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  ClienteParaLembrete,
  ClientesParaLembretePort,
  DasDoCliente,
} from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import {
  linhaDestinatarioSchema,
  paraDestinatario,
} from "@/modules/atendimento/infra/mappers/linha-destinatario.mapper";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { DAS_STATUSES } from "@/shared/kernel/das-status";
import { DOCUMENTO_OBRIGATORIO_STATUSES } from "@/shared/kernel/documento-obrigatorio-status";
import { lerTodasAsPaginas, TAMANHO_DA_PAGINA } from "@/shared/kernel/paginacao-por-cursor";
import { err, ok, type Result } from "@/shared/kernel/result";

const linhaSchema = linhaDestinatarioSchema.extend({
  documento_obrigatorio: z.enum(DOCUMENTO_OBRIGATORIO_STATUSES).nullable(),
  das_status: z.enum(DAS_STATUSES).nullable(),
  data_envio_das: z.string().nullable(),
});

const dasSchema = z
  .object({ dasStatus: z.enum(DAS_STATUSES).nullable(), dataEnvioDas: z.string().nullable() })
  .nullable();

// Usa o client service_role (docs/adr/0001): o job não tem sessão de usuário.
export class SupabaseClientesParaLembreteGateway implements ClientesParaLembretePort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async listar(): Promise<Result<ClienteParaLembrete[], AppError>> {
    const linhas = await lerTodasAsPaginas(
      async (apos) => {
        const { data, error } = await this.supabaseAdmin.rpc("clientes_para_lembrete", {
          p_apos: apos,
          p_limite: TAMANHO_DA_PAGINA,
        });
        const lidas = z.array(linhaSchema).safeParse(data);
        return error || !lidas.success ? null : lidas.data;
      },
      (linha) => linha.cliente_id,
    );
    if (!linhas) return err(new ServicoExternoError("Falha ao ler os Clientes do lembrete."));
    return ok(
      linhas.map((l) => ({
        ...paraDestinatario(l),
        documentoObrigatorio: l.documento_obrigatorio,
        dasStatus: l.das_status,
        dataEnvioDas: l.data_envio_das,
      })),
    );
  }

  async obterDas(clienteId: string): Promise<Result<DasDoCliente | null, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("cliente_cadastro_operacional_sn")
      .select("dasStatus:das_status, dataEnvioDas:data_envio_das")
      .eq("cliente_id", clienteId)
      .maybeSingle();
    const lida = dasSchema.safeParse(data);
    if (error || !lida.success)
      return err(new ServicoExternoError("Falha ao ler o DAS do Cliente."));
    return ok(lida.data);
  }

  async reservarDas(clienteId: string): Promise<Result<string | null, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("reservar_envio_automatico", {
      p_cliente_id: clienteId,
      p_tipo: "das",
    });
    if (error || (data !== null && typeof data !== "string")) {
      return err(new ServicoExternoError("Falha ao reservar o DAS para envio."));
    }
    return ok(data);
  }

  async concluirDas(
    clienteId: string,
    token: string,
    dataIso: string,
  ): Promise<Result<boolean, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("concluir_envio_automatico_das", {
      p_cliente_id: clienteId,
      p_token: token,
      p_data: dataIso,
    });
    if (error || typeof data !== "boolean") {
      return err(new ServicoExternoError("Falha ao registrar o envio do DAS."));
    }
    return ok(data);
  }

  async liberarDas(clienteId: string, token: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.rpc("liberar_envio_automatico", {
      p_cliente_id: clienteId,
      p_tipo: "das",
      p_token: token,
    });
    if (error) return err(new ServicoExternoError("Falha ao liberar a reserva do DAS."));
    return ok(undefined);
  }
}
