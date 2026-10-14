import type { SupabaseClient } from "@supabase/supabase-js";

import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const BUCKET = "guias-fiscais";
// O provedor busca o arquivo logo após o envio; o e-mail pode ser aberto depois, então 7 dias.
const VALIDADE_LINK_SEGUNDOS = 7 * 24 * 60 * 60;

// Usa o client service_role (docs/adr/0001): o job não tem sessão de usuário.
// ponytail: o PDF fica no bucket para sempre; limpar por data se o volume pesar.
export class SupabaseGuiaPublicadaGateway implements GuiaPublicadaPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async publicar(
    clienteId: string,
    guia: { nomeArquivo: string; pdfBase64: string },
  ): Promise<Result<string, AppError>> {
    // Um objeto por envio: o caminho nunca colide e o nome do arquivo não vira caminho.
    const caminho = `${clienteId}/${crypto.randomUUID()}.pdf`;
    const bucket = this.supabaseAdmin.storage.from(BUCKET);
    const { error } = await bucket.upload(caminho, Buffer.from(guia.pdfBase64, "base64"), {
      contentType: "application/pdf",
    });
    if (error) return err(new ServicoExternoError("Falha ao guardar a guia."));
    const link = await bucket.createSignedUrl(caminho, VALIDADE_LINK_SEGUNDOS);
    if (link.error || !link.data) {
      return err(new ServicoExternoError("Falha ao gerar o link da guia."));
    }
    return ok(link.data.signedUrl);
  }
}
