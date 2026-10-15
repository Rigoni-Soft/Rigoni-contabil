import { randomUUID } from "node:crypto";

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
  type CorpoEnvioCloudApi,
  type ParteCorpo,
} from "./corpo-cloud-api";

type RespostaCloudApi =
  | {
      status: 200;
      corpo: {
        messaging_product: "whatsapp";
        contacts: { input: string; wa_id: string }[];
        messages: { id: string; message_status: "accepted" }[];
      };
    }
  | {
      status: number;
      corpo: {
        error: { message: string; type: string; code: number; fbtrace_id: string };
      };
    };

// Códigos de erro da Cloud API (https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes).
const ERROS_CLOUD_API: Record<number, { status: number; titulo: string }> = {
  0: { status: 401, titulo: "AuthException" },
  3: { status: 403, titulo: "Permission Error" },
  4: { status: 429, titulo: "Rate Limit" },
  10: { status: 403, titulo: "Permission Denied" },
  190: { status: 401, titulo: "Token Expired" },
  80007: { status: 429, titulo: "Account Rate Limit" },
  130429: { status: 429, titulo: "Throughput Exceeded" },
  131000: { status: 500, titulo: "Unknown Error" },
  131005: { status: 403, titulo: "Permission Denied" },
  131008: { status: 400, titulo: "Missing Parameter" },
  131009: { status: 400, titulo: "Invalid Parameter" },
  131021: { status: 400, titulo: "Same Number" },
  131026: { status: 400, titulo: "Delivery Failed" },
  131047: { status: 400, titulo: "Conversation Expired" },
  131048: { status: 429, titulo: "Quality Restricted" },
  131049: { status: 429, titulo: "Engagement Limit" },
  131056: { status: 429, titulo: "Recipient Throttled" },
  133010: { status: 400, titulo: "Not Registered" },
};

// 4xx de destinatário/parâmetro não melhora ao tentar de novo; o resto (auth,
// limite de taxa, 5xx) é falha do serviço.
function paraAppError(
  status: number,
  { message, code }: { message: string; code: number },
): AppError {
  const texto = `Envio recusado (${code}): ${message}`;
  return status === 400 ? new ValidationError(texto) : new ServicoExternoError(texto);
}

// Adapter falso (padrão em dev/e2e): reproduz a Cloud API da Meta sem enviar nada.
// `falhas` mapeia um telefone a um código de erro da tabela acima.
// ponytail: listas em memória sem limite, somem a cada restart; trocar por tabela se
// alguém precisar auditar o que "foi enviado" fora de testes.
export class EnvioMensagemFalsoGateway implements EnvioMensagemPort {
  readonly enviadas: MensagemEnviada[] = [];
  readonly documentosEnviados: DocumentoEnviado[] = [];
  readonly templatesEnviados: TemplateEnviado[] = [];
  readonly anexosEnviados: AnexoEnviado[] = [];
  readonly reacoesEnviadas: ReacaoEnviada[] = [];
  readonly requisicoes: CorpoEnvioCloudApi[] = [];

  constructor(private readonly falhas: Record<string, number> = {}) {}

  async enviar(mensagem: MensagemEnviada): Promise<Result<void, AppError>> {
    const enviado = this.despachar({
      to: mensagem.telefone,
      type: "text",
      text: { body: mensagem.texto },
    });
    if (!enviado.ok) return enviado;
    this.enviadas.push(mensagem);
    console.info(`[mensageria falsa] para ${mensagem.telefone}: ${mensagem.texto}`);
    return enviado;
  }

  async enviarDocumento(documento: DocumentoEnviado): Promise<Result<void, AppError>> {
    const enviado = this.despachar({
      to: documento.telefone,
      type: "document",
      document: {
        ...("url" in documento ? { link: documento.url } : { id: `midia-falsa-${randomUUID()}` }),
        filename: documento.nomeArquivo,
      },
    });
    if (!enviado.ok) return enviado;
    this.documentosEnviados.push(documento);
    console.info(
      `[mensageria falsa] para ${documento.telefone}: documento ${documento.nomeArquivo}`,
    );
    return enviado;
  }

  async enviarTemplate(template: TemplateEnviado): Promise<Result<void, AppError>> {
    const enviado = this.despachar(parteTemplate(template));
    if (!enviado.ok) return enviado;
    this.templatesEnviados.push(template);
    console.info(`[mensageria falsa] para ${template.telefone}: template ${template.nome}`);
    return enviado;
  }

  async enviarAnexo(anexo: AnexoEnviado): Promise<Result<void, AppError>> {
    const { telefone, nomeArquivo } = anexo;
    const enviado = this.despachar(parteAnexo(anexo));
    if (!enviado.ok) return enviado;
    this.anexosEnviados.push(anexo);
    console.info(`[mensageria falsa] para ${telefone}: ${anexo.tipo} ${nomeArquivo}`);
    return enviado;
  }

  async reagir(reacao: ReacaoEnviada): Promise<Result<void, AppError>> {
    const enviado = this.despachar(parteReacao(reacao));
    if (!enviado.ok) return enviado;
    this.reacoesEnviadas.push(reacao);
    console.info(
      `[mensageria falsa] para ${reacao.telefone}: reação ${reacao.emoji || "(removida)"}`,
    );
    return enviado;
  }

  private despachar(parte: ParteCorpo): Result<void, AppError> {
    const corpo = envelope(parte);
    this.requisicoes.push(corpo);

    const resposta = this.responder(corpo);
    if ("error" in resposta.corpo) return err(paraAppError(resposta.status, resposta.corpo.error));
    return ok(undefined);
  }

  private responder(corpo: CorpoEnvioCloudApi): RespostaCloudApi {
    const code = this.falhas[corpo.to];
    if (code === undefined) {
      return {
        status: 200,
        corpo: {
          messaging_product: "whatsapp",
          contacts: [{ input: corpo.to, wa_id: corpo.to }],
          messages: [{ id: `wamid.FALSO${randomUUID()}`, message_status: "accepted" }],
        },
      };
    }
    const { status, titulo } = ERROS_CLOUD_API[code];
    return {
      status,
      corpo: {
        error: { message: titulo, type: "OAuthException", code, fbtrace_id: randomUUID() },
      },
    };
  }
}
