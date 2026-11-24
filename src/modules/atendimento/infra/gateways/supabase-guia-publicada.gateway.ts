import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  GuiaPublicada,
  GuiaPublicadaPort,
} from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { ChaveGuia } from "@/modules/atendimento/domain/services/guia-guardada.service";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const BUCKET = "guias-fiscais";
const VALIDADE_LINK_SEGUNDOS = 7 * 24 * 60 * 60;

const STATUS_OBJETO_JA_EXISTE = "409";

const pertenceAoCliente = (clienteId: string, caminho: string) =>
  caminho.startsWith(`${clienteId}/`) && !caminho.includes("..");

const pastaDaGuia = (clienteId: string, { id }: ChaveGuia) => `${clienteId}/${id}`;

export class SupabaseGuiaPublicadaGateway implements GuiaPublicadaPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async publicar(
    clienteId: string,
    guia: { nomeArquivo: string; pdfBase64: string },
    chave: ChaveGuia,
  ): Promise<Result<GuiaPublicada, AppError>> {
    const bytes = Buffer.from(guia.pdfBase64, "base64");
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const caminho = `${pastaDaGuia(clienteId, chave)}/${chave.periodo}-${hash}.pdf`;
    const bucket = this.supabaseAdmin.storage.from(BUCKET);
    const { error } = await bucket.upload(caminho, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    const jaExistia =
      (error as { statusCode?: string } | null)?.statusCode === STATUS_OBJETO_JA_EXISTE;
    if (error && !jaExistia) return err(new ServicoExternoError("Falha ao guardar a guia."));
    const link = await bucket.createSignedUrl(caminho, VALIDADE_LINK_SEGUNDOS);
    if (link.error || !link.data) {
      return err(new ServicoExternoError("Falha ao gerar o link da guia."));
    }
    return ok({ url: link.data.signedUrl, caminho });
  }

  async reencontrar(clienteId: string, caminho: string): Promise<Result<string, AppError>> {
    if (!pertenceAoCliente(clienteId, caminho)) {
      return err(new ServicoExternoError("Guia não pertence ao cliente."));
    }
    const link = await this.supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(caminho, VALIDADE_LINK_SEGUNDOS);
    if (link.error || !link.data) {
      return err(new ServicoExternoError("Falha ao gerar o link da guia."));
    }
    return ok(link.data.signedUrl);
  }
}
