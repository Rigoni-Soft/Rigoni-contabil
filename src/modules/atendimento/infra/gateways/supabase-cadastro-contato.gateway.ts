import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CadastroContatoPort,
  ClienteEncontrado,
} from "@/modules/atendimento/application/ports/out/cadastro-contato.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const UNIQUE_VIOLATION = "23505";

function falha(acao: string): Result<never, AppError> {
  return err(new ServicoExternoError(`Falha ao ${acao}.`));
}

// Usa o client service_role (docs/adr/0001): quem escreve pelo WhatsApp não tem sessão.
export class SupabaseCadastroContatoGateway implements CadastroContatoPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async buscarCliente(cnpj: string): Promise<Result<ClienteEncontrado | null, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("clientes")
      .select("id, empresa")
      .eq("cnpj", cnpj)
      .maybeSingle();
    if (error) return falha("buscar o cliente");
    if (!data) return ok(null);

    const padrao = await this.supabaseAdmin
      .from("cliente_contatos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", data.id)
      .eq("padrao", true);
    if (padrao.error) return falha("buscar o cliente");
    return ok({ clienteId: data.id, empresa: data.empresa, temPadrao: (padrao.count ?? 0) > 0 });
  }

  async cadastrar(contato: {
    clienteId: string;
    nome: string;
    telefone: string;
  }): Promise<Result<{ empresa: string; padrao: boolean }, AppError>> {
    const cliente = await this.supabaseAdmin
      .from("clientes")
      .select("empresa")
      .eq("id", contato.clienteId)
      .maybeSingle();
    if (cliente.error || !cliente.data) return falha("cadastrar o contato");

    const inserir = (padrao: boolean) =>
      this.supabaseAdmin.from("cliente_contatos").insert({
        id: crypto.randomUUID(),
        cliente_id: contato.clienteId,
        nome: contato.nome,
        telefone: contato.telefone,
        padrao,
      });

    // Tenta como padrão; o índice único parcial (1 padrão por Cliente) decide a corrida: se outro
    // contato virou padrão no meio do caminho, este entra como "outro contato".
    let padrao = true;
    let { error } = await inserir(true);
    if (error?.code === UNIQUE_VIOLATION) {
      padrao = false;
      ({ error } = await inserir(false));
    }
    if (error) return falha("cadastrar o contato");
    return ok({ empresa: cliente.data.empresa, padrao });
  }
}
