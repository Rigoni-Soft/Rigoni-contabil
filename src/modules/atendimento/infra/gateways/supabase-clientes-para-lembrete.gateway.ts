import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  ClienteParaLembrete,
  ClientesParaLembretePort,
} from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import {
  linhaDestinatarioSchema,
  paraDestinatario,
} from "@/modules/atendimento/infra/mappers/linha-destinatario.mapper";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { DAS_STATUSES } from "@/shared/kernel/das-status";
import { DOCUMENTO_OBRIGATORIO_STATUSES } from "@/shared/kernel/documento-obrigatorio-status";
import { err, ok, type Result } from "@/shared/kernel/result";

const linhaSchema = linhaDestinatarioSchema.extend({
  documento_obrigatorio: z.enum(DOCUMENTO_OBRIGATORIO_STATUSES).nullable(),
  das_status: z.enum(DAS_STATUSES).nullable(),
  data_envio_das: z.string().nullable(),
});

// Usa o client service_role (docs/adr/0001): o job não tem sessão de usuário.
export class SupabaseClientesParaLembreteGateway implements ClientesParaLembretePort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async listar(): Promise<Result<ClienteParaLembrete[], AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("clientes_para_lembrete");
    const linhas = z.array(linhaSchema).safeParse(data);
    if (error || !linhas.success) {
      return err(new ServicoExternoError("Falha ao ler os Clientes do lembrete."));
    }
    return ok(
      linhas.data.map((l) => ({
        ...paraDestinatario(l),
        documentoObrigatorio: l.documento_obrigatorio,
        dasStatus: l.das_status,
        dataEnvioDas: l.data_envio_das,
      })),
    );
  }

  async reivindicarDas(clienteId: string, dataIso: string): Promise<Result<boolean, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("reivindicar_das_para_envio", {
      p_cliente_id: clienteId,
      p_data: dataIso,
    });
    if (error || typeof data !== "boolean") {
      return err(new ServicoExternoError("Falha ao reivindicar o DAS para envio."));
    }
    return ok(data);
  }

  async desfazerDas(
    clienteId: string,
    dataAnterior: string | null,
  ): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.rpc("desfazer_envio_das_automatico", {
      p_cliente_id: clienteId,
      p_data_anterior: dataAnterior,
    });
    if (error) return err(new ServicoExternoError("Falha ao devolver o DAS a pronto."));
    return ok(undefined);
  }
}
