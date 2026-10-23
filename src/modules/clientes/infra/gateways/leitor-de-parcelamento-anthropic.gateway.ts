import { z } from "zod";

import type {
  LeitorDeParcelamentoPort,
  LeituraDeParcelamento,
} from "@/modules/clientes/application/ports/out/leitor-de-parcelamento.provider";

const URL_MENSAGENS = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 30_000;

const PROMPT =
  "Este PDF é um documento de parcelamento de débitos do Simples Nacional/MEI (recibo de adesão, " +
  "extrato ou termo). Extraia: `codigo`, o número ou código que identifica o parcelamento, " +
  "exatamente como impresso (null se o documento não trouxer nenhum; não use CNPJ, CPF, número do " +
  "recibo nem certificado); e `quantidadeDeParcelas`, quantas parcelas restam a pagar (num recibo " +
  "de adesão, o número total de parcelas). Se não tiver certeza da quantidade, devolva null.";

// Saída estruturada GA (`output_config.format`), não tool use forçado (400 nos modelos 5.5). Os
// limites (quantidade >= 1) ficam no domínio: o schema da API não aceita minimum.
const SCHEMA = {
  type: "object",
  properties: {
    codigo: { anyOf: [{ type: "string" }, { type: "null" }] },
    quantidadeDeParcelas: { anyOf: [{ type: "integer" }, { type: "null" }] },
  },
  required: ["codigo", "quantidadeDeParcelas"],
  additionalProperties: false,
};

const leituraSchema = z.object({
  codigo: z.string().nullable(),
  quantidadeDeParcelas: z.number().int(),
});

const FALHA = (motivo: Extract<LeituraDeParcelamento, { lido: false }>["motivo"]) =>
  ({ lido: false, motivo }) as const;

// Adapter da Messages API (docs/pesquisa/anthropic-leitura-pdf.md): o PDF vai inline em base64, sem
// Files API (dado fiscal). Sem SDK e sem retentativa: falha só libera a digitação à mão.
export class LeitorDeParcelamentoAnthropicGateway implements LeitorDeParcelamentoPort {
  constructor(
    private readonly config: { chave: string; modelo: string },
    private readonly http: typeof fetch = fetch,
  ) {}

  async ler(pdf: Uint8Array): Promise<LeituraDeParcelamento> {
    let resposta: Response;
    try {
      resposta = await this.http(URL_MENSAGENS, {
        method: "POST",
        headers: {
          "x-api-key": this.config.chave,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.modelo,
          max_tokens: 256,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: Buffer.from(pdf).toString("base64"),
                  },
                },
                { type: "text", text: PROMPT },
              ],
            },
          ],
          output_config: { format: { type: "json_schema", schema: SCHEMA } },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      console.error("Leitor de PDF: provedor inacessível.");
      return FALHA("indisponivel");
    }

    if (!resposta.ok) {
      console.error("Leitor de PDF: provedor respondeu", resposta.status, {
        requestId: resposta.headers.get("request-id"),
      });
      if (resposta.status === 429 || resposta.status === 413) return FALHA("limite");
      return FALHA("indisponivel");
    }

    const corpo = (await resposta.json()) as {
      stop_reason?: string;
      content?: { type: string; text?: string }[];
    };
    if (corpo.stop_reason === "refusal") return FALHA("recusado");
    if (corpo.stop_reason === "max_tokens") return FALHA("ilegivel");
    try {
      const texto = corpo.content?.find((bloco) => bloco.type === "text")?.text ?? "";
      const lido = leituraSchema.safeParse(JSON.parse(texto));
      return lido.success ? { lido: true, ...lido.data } : FALHA("ilegivel");
    } catch {
      return FALHA("ilegivel");
    }
  }
}
