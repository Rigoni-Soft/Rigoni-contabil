import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ContatoAmbiguo,
  ContatoIdentificado,
  IdentificacaoContatoPort,
} from "@/modules/atendimento/application/ports/out/identificacao-contato.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Usa o client service_role (docs/adr/0001): quem escreve pelo WhatsApp não tem sessão.
export class SupabaseIdentificacaoContatoGateway implements IdentificacaoContatoPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async identificar(
    telefone: string,
  ): Promise<Result<ContatoIdentificado | ContatoAmbiguo | null, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("identificar_contato_por_telefone", {
      p_telefone: telefone,
    });
    if (error) return err(new ServicoExternoError("Falha ao identificar o contato."));
    // Ordenadas por padrão e antiguidade: vários Contatos do mesmo Cliente não são ambiguidade.
    const linhas = (data as { cliente_id: string; nome: string; empresa: string }[] | null) ?? [];
    if (new Set(linhas.map((l) => l.cliente_id)).size > 1) return ok("ambiguo");
    const linha = linhas[0];
    if (!linha) return ok(null);
    return ok({ clienteId: linha.cliente_id, nome: linha.nome, empresa: linha.empresa });
  }

  // Só existência: não há linha de Cliente a mapear, então não passa por Row DTO.
  async cnpjCadastrado(cnpj: string): Promise<Result<boolean, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("clientes")
      .select("id")
      .eq("cnpj", cnpj)
      .maybeSingle();
    if (error) return err(new ServicoExternoError("Falha ao consultar o CNPJ."));
    return ok(data !== null);
  }
}
