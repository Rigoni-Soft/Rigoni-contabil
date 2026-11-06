import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  ClienteParaParcelamento,
  ClientesParaParcelamentoPort,
} from "@/modules/atendimento/application/ports/out/clientes-para-parcelamento.provider";
import {
  linhaDestinatarioSchema,
  paraDestinatario,
} from "@/modules/atendimento/infra/mappers/linha-destinatario.mapper";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { lerTodasAsPaginas, TAMANHO_DA_PAGINA } from "@/shared/kernel/paginacao-por-cursor";
import { err, ok, type Result } from "@/shared/kernel/result";

// Usa o client service_role (docs/adr/0001): o job não tem sessão de usuário.
export class SupabaseClientesParaParcelamentoGateway implements ClientesParaParcelamentoPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async listarPendentes(): Promise<Result<ClienteParaParcelamento[], AppError>> {
    const linhas = await lerTodasAsPaginas(
      async (apos) => {
        const { data, error } = await this.supabaseAdmin.rpc("clientes_para_parcelamento", {
          p_apos: apos,
          p_limite: TAMANHO_DA_PAGINA,
        });
        const lidas = z.array(linhaDestinatarioSchema).safeParse(data);
        return error || !lidas.success ? null : lidas.data;
      },
      (linha) => linha.cliente_id,
    );
    if (!linhas) {
      return err(new ServicoExternoError("Falha ao ler os Clientes com Parcelamento pendente."));
    }
    return ok(linhas.map(paraDestinatario));
  }

  async reservar(clienteId: string): Promise<Result<string | null, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("reservar_envio_automatico", {
      p_cliente_id: clienteId,
      p_tipo: "parcelamento",
    });
    if (error || (data !== null && typeof data !== "string")) {
      return err(new ServicoExternoError("Falha ao reservar o Parcelamento para envio."));
    }
    return ok(data);
  }

  async concluir(clienteId: string, token: string): Promise<Result<boolean, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("concluir_envio_automatico_parcelamento", {
      p_cliente_id: clienteId,
      p_token: token,
    });
    if (error || typeof data !== "boolean") {
      return err(new ServicoExternoError("Falha ao registrar o envio do Parcelamento."));
    }
    return ok(data);
  }

  async liberar(clienteId: string, token: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.rpc("liberar_envio_automatico", {
      p_cliente_id: clienteId,
      p_tipo: "parcelamento",
      p_token: token,
    });
    if (error) return err(new ServicoExternoError("Falha ao liberar a reserva do Parcelamento."));
    return ok(undefined);
  }
}
