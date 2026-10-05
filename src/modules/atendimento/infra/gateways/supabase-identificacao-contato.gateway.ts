import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ContatoIdentificado,
  IdentificacaoContatoPort,
} from "@/modules/atendimento/application/ports/out/identificacao-contato.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Usa o client service_role (docs/adr/0001): quem escreve pelo WhatsApp não tem sessão.
export class SupabaseIdentificacaoContatoGateway implements IdentificacaoContatoPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async identificar(telefone: string): Promise<Result<ContatoIdentificado | null, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("identificar_contato_por_telefone", {
      p_telefone: telefone,
    });
    if (error) return err(new ServicoExternoError("Falha ao identificar o contato."));
    const linha = (data as ContatoIdentificado[])[0];
    return ok(linha ?? null);
  }
}
