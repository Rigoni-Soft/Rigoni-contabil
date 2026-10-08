import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DocumentoContratual,
  DocumentosContratuaisPort,
} from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const BUCKET = "documentos-clientes";
// A Meta busca o arquivo logo após o envio; 5 min cobre atraso sem deixar o link vivo.
const VALIDADE_LINK_SEGUNDOS = 300;

// Usa o client service_role (docs/adr/0001): quem escreve pelo WhatsApp não tem sessão,
// e as policies de documentos-clientes só abrem para o Admin.
export class SupabaseDocumentosContratuaisGateway implements DocumentosContratuaisPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async listar(clienteId: string): Promise<Result<DocumentoContratual[], AppError>> {
    const [cliente, alteracoes] = await Promise.all([
      this.supabaseAdmin
        .from("clientes")
        .select("contrato_social_caminho")
        .eq("id", clienteId)
        .maybeSingle(),
      this.supabaseAdmin
        .from("cliente_alteracoes_contratuais")
        .select("data, arquivo_caminho")
        .eq("cliente_id", clienteId)
        .order("data"),
    ]);
    if (cliente.error || alteracoes.error) {
      return err(new ServicoExternoError("Falha ao consultar os documentos do cliente."));
    }

    const documentos: DocumentoContratual[] = [];
    const contrato = cliente.data?.contrato_social_caminho as string | null | undefined;
    if (contrato) documentos.push({ tipo: "contrato", data: null, caminho: contrato });
    for (const a of alteracoes.data as { data: string; arquivo_caminho: string }[]) {
      documentos.push({ tipo: "alteracao", data: a.data, caminho: a.arquivo_caminho });
    }
    return ok(documentos);
  }

  async linkTemporario(caminho: string): Promise<Result<string, AppError>> {
    const { data, error } = await this.supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(caminho, VALIDADE_LINK_SEGUNDOS);
    if (error || !data) return err(new ServicoExternoError("Falha ao gerar o link do documento."));
    return ok(data.signedUrl);
  }
}
