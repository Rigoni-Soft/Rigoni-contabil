import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AlertaSetor,
  AlertaSetorPort,
} from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const VIOLACAO_UNICIDADE = "23505";

// Usa o client service_role (docs/adr/0001): o job não tem sessão de usuário.
export class SupabaseAlertaSetorGateway implements AlertaSetorPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async alertar(alerta: AlertaSetor): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.from("alertas_setor").insert({
      setor: alerta.setor,
      tipo: alerta.tipo,
      cliente_id: alerta.clienteId,
      mensagem: alerta.mensagem,
    });
    // Já há um alerta aberto do mesmo tipo para o Cliente: é o que o setor precisa ver.
    if (error && error.code !== VIOLACAO_UNICIDADE) {
      return err(new ServicoExternoError("Falha ao gravar o alerta do setor."));
    }
    return ok(undefined);
  }
}
