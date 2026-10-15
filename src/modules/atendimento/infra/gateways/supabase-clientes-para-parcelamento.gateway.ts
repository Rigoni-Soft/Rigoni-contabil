import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  ClienteParaParcelamento,
  ClientesParaParcelamentoPort,
} from "@/modules/atendimento/application/ports/out/clientes-para-parcelamento.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { FORMAS_ENVIO } from "@/shared/kernel/forma-envio";
import { err, ok, type Result } from "@/shared/kernel/result";

const linhaSchema = z.object({
  cliente_id: z.string(),
  email: z.string().nullable(),
  empresa: z.string(),
  forma_envio: z.enum(FORMAS_ENVIO),
  contato_nome: z.string().nullable(),
  contato_telefone: z.string().nullable(),
  ultima_mensagem_do_contato_em: z.string().nullable(),
});

// Usa o client service_role (docs/adr/0001): o job não tem sessão de usuário.
export class SupabaseClientesParaParcelamentoGateway implements ClientesParaParcelamentoPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async listarPendentes(): Promise<Result<ClienteParaParcelamento[], AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("clientes_para_parcelamento");
    const linhas = z.array(linhaSchema).safeParse(data);
    if (error || !linhas.success) {
      return err(new ServicoExternoError("Falha ao ler os Clientes com Parcelamento pendente."));
    }
    return ok(
      linhas.data.map((l) => ({
        clienteId: l.cliente_id,
        empresa: l.empresa,
        formaEnvio: l.forma_envio,
        contato:
          l.contato_nome && l.contato_telefone
            ? { nome: l.contato_nome, telefone: l.contato_telefone }
            : null,
        email: l.email,
        ultimaMensagemDoContatoEm: l.ultima_mensagem_do_contato_em
          ? new Date(l.ultima_mensagem_do_contato_em)
          : null,
      })),
    );
  }

  async reivindicar(clienteId: string): Promise<Result<boolean, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("reivindicar_parcelamento_para_envio", {
      p_cliente_id: clienteId,
    });
    if (error || typeof data !== "boolean") {
      return err(new ServicoExternoError("Falha ao reivindicar o Parcelamento para envio."));
    }
    return ok(data);
  }

  async desfazer(clienteId: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.rpc("desfazer_envio_parcelamento_automatico", {
      p_cliente_id: clienteId,
    });
    if (error) return err(new ServicoExternoError("Falha ao devolver o Parcelamento a pendente."));
    return ok(undefined);
  }
}
