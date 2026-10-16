import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CadastroFiscalCliente,
  ClienteCnpjPort,
} from "@/modules/atendimento/application/ports/out/cliente-cnpj.provider";
import { clienteCnpjRowSchema } from "@/modules/atendimento/infra/dtos/cliente-cnpj-row.dto";
import type { AppError } from "@/shared/errors/app.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Usa o client service_role (docs/adr/0001): quem escreve pelo WhatsApp não tem sessão.
export class SupabaseClienteCnpjGateway implements ClienteCnpjPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async cadastroFiscalDoCliente(
    clienteId: string,
  ): Promise<Result<CadastroFiscalCliente, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("clientes")
      .select("cnpj, regime")
      .eq("id", clienteId)
      .maybeSingle();
    if (error) return err(new ServicoExternoError("Falha ao ler o CNPJ do Cliente."));
    if (!data) return err(new NotFoundError("Cliente não encontrado."));
    const linha = clienteCnpjRowSchema.safeParse(data);
    if (!linha.success) return err(new ServicoExternoError("CNPJ do Cliente em formato inválido."));
    return ok(linha.data);
  }
}
