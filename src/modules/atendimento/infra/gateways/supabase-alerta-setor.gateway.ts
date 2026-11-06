import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AlertaSetor,
  AlertaSetorPort,
} from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

type OrigemAlertaSetor = "lembretes" | "parcelamento" | "lembrete_pgfn";

// Usa o client service_role (docs/adr/0001): o job não tem sessão de usuário. Cada job grava e
// resolve só os alertas da própria origem.
export class SupabaseAlertaSetorGateway implements AlertaSetorPort {
  constructor(
    private readonly supabaseAdmin: SupabaseClient,
    private readonly origem: OrigemAlertaSetor,
  ) {}

  async alertar(alerta: AlertaSetor): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.rpc("registrar_alerta_setor", {
      p_setor: alerta.setor,
      p_tipo: alerta.tipo,
      p_cliente_id: alerta.clienteId,
      p_mensagem: alerta.mensagem,
      p_origem: this.origem,
    });
    if (error) return err(new ServicoExternoError("Falha ao gravar o alerta do setor."));
    return ok(undefined);
  }

  async resolverNaoRenovados(desde: Date, clienteIds: string[]): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.rpc("resolver_alertas_setor_nao_renovados", {
      p_desde: desde.toISOString(),
      p_origem: this.origem,
      p_cliente_ids: clienteIds,
    });
    if (error) return err(new ServicoExternoError("Falha ao resolver os alertas do setor."));
    return ok(undefined);
  }
}
