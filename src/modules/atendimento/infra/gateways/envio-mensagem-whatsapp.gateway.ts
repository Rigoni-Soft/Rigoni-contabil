import type {
  AnexoEnviado,
  DocumentoEnviado,
  EnvioMensagemPort,
  MensagemEnviada,
  ReacaoEnviada,
  TemplateEnviado,
} from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import {
  envelope,
  parteAnexo,
  parteReacao,
  parteTemplate,
  type ParteCorpo,
} from "./corpo-cloud-api.gateway";

const VERSAO_API = "v21.0";
const TIMEOUT_MS = 10_000;

// Adapter real da porta EnvioMensagemPort (#68), pela WhatsApp Cloud API (Meta). 400 (número sem
// WhatsApp, janela de 24h, parâmetro inválido) não melhora ao repetir: ValidationError. O resto
// (401/403 de credencial, 429 de limite de taxa, 5xx, rede) é falha do serviço: ServicoExternoError.
export class EnvioMensagemWhatsappGateway implements EnvioMensagemPort {
  private readonly base: string;

  constructor(
    private readonly token: string,
    phoneNumberId: string,
    private readonly http: typeof fetch = fetch,
  ) {
    this.base = `https://graph.facebook.com/${VERSAO_API}/${phoneNumberId}`;
  }

  enviar({ telefone, texto }: MensagemEnviada): Promise<Result<void, AppError>> {
    return this.mensagem({ to: telefone, type: "text", text: { body: texto } });
  }

  async enviarDocumento(documento: DocumentoEnviado): Promise<Result<void, AppError>> {
    const filename = documento.nomeArquivo;
    if ("url" in documento) {
      const document = { link: documento.url, filename };
      return this.mensagem({ to: documento.telefone, type: "document", document });
    }
    const midia = await this.subirMidia(documento.pdfBase64, filename);
    if (!midia.ok) return midia;
    const document = { id: midia.value, filename };
    return this.mensagem({ to: documento.telefone, type: "document", document });
  }

  enviarTemplate(template: TemplateEnviado): Promise<Result<void, AppError>> {
    return this.mensagem(parteTemplate(template));
  }

  enviarAnexo(anexo: AnexoEnviado): Promise<Result<void, AppError>> {
    return this.mensagem(parteAnexo(anexo));
  }

  reagir(reacao: ReacaoEnviada): Promise<Result<void, AppError>> {
    return this.mensagem(parteReacao(reacao));
  }

  private async mensagem(parte: ParteCorpo): Promise<Result<void, AppError>> {
    const corpo = JSON.stringify(envelope(parte));
    const r = await this.chamar("/messages", { "Content-Type": "application/json" }, corpo);
    return r.ok ? ok(undefined) : r;
  }

  // Sobe o PDF como mídia e devolve o id que o envio de documento referencia.
  private async subirMidia(
    pdfBase64: string,
    nomeArquivo: string,
  ): Promise<Result<string, AppError>> {
    const pdf = new Blob([Buffer.from(pdfBase64, "base64")], { type: "application/pdf" });
    const form = new FormData();
    form.set("messaging_product", "whatsapp");
    form.set("type", "application/pdf");
    form.set("file", pdf, nomeArquivo);
    const r = await this.chamar("/media", {}, form);
    if (!r.ok) return r;
    const id = (r.value as { id?: unknown } | null)?.id;
    return typeof id === "string"
      ? ok(id)
      : err(new ServicoExternoError("Serviço de mensageria não devolveu o id da mídia."));
  }

  private async chamar(
    caminho: string,
    headers: Record<string, string>,
    body: string | FormData,
  ): Promise<Result<unknown, AppError>> {
    try {
      const resposta = await this.http(`${this.base}${caminho}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, ...headers },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (resposta.ok) return ok(await resposta.json().catch(() => null));
      const detalhe = (await resposta.json().catch(() => null)) as {
        error?: { code?: number; message?: string };
      } | null;
      const { code, message } = detalhe?.error ?? {};
      const texto = `Envio recusado (${code ?? resposta.status}): ${message ?? "sem detalhe"}`;
      return err(
        resposta.status === 400 ? new ValidationError(texto) : new ServicoExternoError(texto),
      );
    } catch {
      return err(new ServicoExternoError("Serviço de mensageria indisponível."));
    }
  }
}
