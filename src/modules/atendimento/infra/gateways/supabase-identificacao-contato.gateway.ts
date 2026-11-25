import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ContatoAmbiguo,
  ContatoIdentificado,
  IdentificacaoContatoPort,
} from "@/modules/atendimento/application/ports/out/identificacao-contato.provider";
import { clienteRegimeRowSchema } from "@/modules/atendimento/infra/dtos/cliente-regime-row.dto";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class SupabaseIdentificacaoContatoGateway implements IdentificacaoContatoPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async identificar(
    telefone: string,
  ): Promise<Result<ContatoIdentificado | ContatoAmbiguo | null, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("identificar_contato_por_telefone", {
      p_telefone: telefone,
    });
    if (error) return err(new ServicoExternoError("Falha ao identificar o contato."));
    const linhas = (data as { cliente_id: string; nome: string; empresa: string }[] | null) ?? [];
    if (new Set(linhas.map((l) => l.cliente_id)).size > 1) return ok("ambiguo");
    const linha = linhas[0];
    if (!linha) return ok(null);
    return ok({ clienteId: linha.cliente_id, nome: linha.nome, empresa: linha.empresa });
  }

  async regimeDoCliente(clienteId: string): Promise<Result<string | null, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("clientes")
      .select("regime")
      .eq("id", clienteId)
      .maybeSingle();
    if (error) return err(new ServicoExternoError("Falha ao consultar o regime do Cliente."));
    if (!data) return ok(null);
    const linha = clienteRegimeRowSchema.safeParse(data);
    if (!linha.success) {
      return err(new ServicoExternoError("Regime do Cliente em formato inválido."));
    }
    return ok(linha.data.regime);
  }

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
