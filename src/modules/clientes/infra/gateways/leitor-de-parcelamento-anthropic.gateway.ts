import { z } from "zod";

import type {
  LeitorDeParcelamentoPort,
  LeituraDeParcelamento,
} from "@/modules/clientes/application/ports/out/leitor-de-parcelamento.provider";
import type { OrigemDoParcelamento } from "@/modules/clientes/domain/value-objects/parcelamento.vo";

const URL_MENSAGENS = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 30_000;

const PROMPT = [
  "Este PDF é o comprovante de um parcelamento de débitos de empresa: recibo de adesão da Receita",
  "Federal (Simples Nacional/MEI), recibo de transação da PGFN (SISPAR/Regularize) ou documento",
  "equivalente. Extraia, usando null para o que o documento não trouxer (nunca invente):",
  "- cnpj: o CNPJ do contribuinte (empresa), como impresso.",
  "- origem: 'receita_federal' se o documento é da Receita Federal/Ministério da Fazenda;",
  "'pgfn' se é da Procuradoria-Geral da Fazenda Nacional (PGFN, SISPAR, Regularize).",
  "- codigo: o número que identifica o parcelamento, como impresso. Na PGFN é o 'Número da conta de",
  "negociação'. Documento da Receita sem esse número: null. Nunca use CNPJ, CPF, número do recibo,",
  "certificado, número de dívida/inscrição ou código de receita.",
  "- totalDeParcelas: quantas parcelas/prestações o acordo tem no total. Se o documento só lista",
  "'entrada' e 'prestações' (ex.: Entrada 1x + Básica 4x), some todas (5).",
  "- quantidadeDeParcelas: quantas ainda restam a pagar. Em recibo de adesão, é igual ao total.",
  "Se não tiver certeza, devolva null.",
  "- valorDaParcelaCentavos: valor de cada parcela comum, em centavos inteiros (R$ 316,20 = 31620);",
  "ignore o valor da entrada quando for diferente das demais.",
  "- dataDeAdesao: data em que o acordo foi feito/confirmado, AAAA-MM-DD.",
].join(" ");

// Saída estruturada GA (`output_config.format`), não tool use forçado (400 nos modelos 5.5). Os
// limites (quantidade >= 1 etc.) ficam no domínio: o schema da API não aceita minimum.
const anulavel = (tipo: object) => ({ anyOf: [tipo, { type: "null" }] });
const SCHEMA = {
  type: "object",
  properties: {
    cnpj: anulavel({ type: "string" }),
    origem: anulavel({ type: "string", enum: ["receita_federal", "pgfn"] }),
    codigo: anulavel({ type: "string" }),
    totalDeParcelas: anulavel({ type: "integer" }),
    quantidadeDeParcelas: anulavel({ type: "integer" }),
    valorDaParcelaCentavos: anulavel({ type: "integer" }),
    dataDeAdesao: anulavel({ type: "string" }),
  },
  required: [
    "cnpj",
    "origem",
    "codigo",
    "totalDeParcelas",
    "quantidadeDeParcelas",
    "valorDaParcelaCentavos",
    "dataDeAdesao",
  ],
  additionalProperties: false,
};

// Só a quantidade de parcelas é indispensável; o resto é informativo e vira nulo se faltar (o domínio
// ainda valida o formato de cada um).
const leituraSchema = z.object({
  codigo: z.string().nullable(),
  quantidadeDeParcelas: z.number().int(),
  cnpj: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  origem: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  totalDeParcelas: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  valorDaParcelaCentavos: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  dataDeAdesao: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
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
      return lido.success
        ? { lido: true, ...lido.data, origem: lido.data.origem as OrigemDoParcelamento | null }
        : FALHA("ilegivel");
    } catch {
      return FALHA("ilegivel");
    }
  }
}
