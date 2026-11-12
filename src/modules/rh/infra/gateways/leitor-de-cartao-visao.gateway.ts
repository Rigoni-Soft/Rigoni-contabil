import { z } from "zod";

import type {
  AtestadoBruto,
  ImagemDoCartao,
  LeitorDeCartaoPort,
  LeituraBruta,
} from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";
import { horaParaMinutos } from "@/modules/rh/domain/services/totalizacao.service";

// Leitor da foto do cartão: visão de um modelo de linguagem. A foto com dado
// pessoal sai do servidor (ADR 0011: retenção zero e contrato sem treino no provedor); a resposta é JSON de
// uma ferramenta com esquema, validado aqui e de novo pelo domínio. Nunca lança: erro de rede, status ou
// formato vira `{ lido: false }`.
const URL_DA_API = "https://api.anthropic.com/v1/messages";
const TEMPO_MAXIMO_MS = 45_000;

const horario = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/);
const par = z.object({ entrada: horario, saida: horario });
const resposta = z.object({
  nome: z.string().nullable(),
  dias: z.array(
    z.object({
      dia: z.number().int(),
      batidas: z.array(par).max(2),
      extra: par.nullable(),
      anotacao: z.enum(["faltou", "atestado"]).nullable(),
    }),
  ),
});

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
// Só estes campos: o z.object descarta o resto (CID, documento, diagnóstico).
const respostaAtestado = z.object({
  nome: z.string().nullable(),
  tipo: z.enum(["atestado", "declaracao"]),
  de: dataIso,
  ate: dataIso,
});

const PAR_JSON = {
  type: "object",
  properties: {
    entrada: { type: "string", description: "HH:MM" },
    saida: { type: "string", description: "HH:MM" },
  },
  required: ["entrada", "saida"],
};

const FERRAMENTA = {
  name: "registrar_cartao",
  description: "Registra o que está escrito no cartão de ponto da foto.",
  input_schema: {
    type: "object",
    properties: {
      nome: {
        type: ["string", "null"],
        description: "Nome do empregado, como escrito; null se ilegível.",
      },
      dias: {
        type: "array",
        description: "Uma entrada por linha do cartão que tenha horário, extra ou anotação.",
        items: {
          type: "object",
          properties: {
            dia: { type: "integer", description: "Número do dia impresso na linha." },
            batidas: {
              type: "array",
              description: "Pares da manhã e da tarde, nessa ordem; omita o par sem batida.",
              items: PAR_JSON,
            },
            extra: { ...PAR_JSON, type: ["object", "null"], description: "Coluna EXTRA do dia." },
            anotacao: {
              type: ["string", "null"],
              enum: ["faltou", "atestado", null],
              description: "Anotação escrita no dia: 'faltou' ou 'atestado'; null se não há.",
            },
          },
          required: ["dia", "batidas", "extra", "anotacao"],
        },
      },
    },
    required: ["nome", "dias"],
  },
};

const FERRAMENTA_ATESTADO = {
  name: "registrar_atestado",
  description: "Registra nome e datas do atestado ou da declaração de comparecimento da foto.",
  input_schema: {
    type: "object",
    properties: {
      nome: {
        type: ["string", "null"],
        description: "Nome da pessoa atestada, como escrito; null se ilegível.",
      },
      tipo: {
        type: "string",
        enum: ["atestado", "declaracao"],
        description:
          "atestado = afastamento do trabalho; declaracao = declaração de comparecimento (consulta, exame, acompanhamento).",
      },
      de: {
        type: ["string", "null"],
        description:
          "AAAA-MM-DD: primeiro dia do afastamento, ou o dia do comparecimento. null se ilegível.",
      },
      ate: {
        type: ["string", "null"],
        description: "AAAA-MM-DD: último dia do afastamento; null na declaração ou se ilegível.",
      },
    },
    required: ["nome", "tipo", "de", "ate"],
  },
};

const INSTRUCAO_ATESTADO =
  "Esta é a foto de um atestado médico ou de uma declaração de comparecimento. Registre só o nome da pessoa " +
  "atestada, se é atestado (afastamento) ou declaração de comparecimento, e as datas. Ignore e não registre " +
  "diagnóstico, CID, documentos, médico ou clínica. Não invente: data ilegível fica null. " +
  "Responda só pela ferramenta registrar_atestado.";

const INSTRUCAO =
  "Esta é a foto de um cartão de ponto de uma quinzena (colunas MANHÃ, TARDE e EXTRA; uma linha por dia). " +
  "Leia o nome do empregado e, para cada dia, os horários de entrada e saída (carimbados ou escritos à mão), " +
  "a coluna EXTRA e anotações como 'faltou' ou 'atestado'. Não invente: horário ilegível fica de fora. " +
  "Responda só pela ferramenta registrar_cartao.";

const paraPar = (p: z.infer<typeof par>) => ({
  entrada: horaParaMinutos(p.entrada),
  saida: horaParaMinutos(p.saida),
});

export class LeitorDeCartaoVisaoGateway implements LeitorDeCartaoPort {
  constructor(
    private readonly chave: string,
    private readonly modelo: string,
    private readonly http: typeof fetch = fetch,
  ) {}

  async ler(imagem: ImagemDoCartao): Promise<LeituraBruta> {
    const lida = resposta.safeParse(await this.chamar(imagem, FERRAMENTA, INSTRUCAO));
    if (!lida.success) return { lido: false };
    return {
      lido: true,
      leitura: {
        nome: lida.data.nome,
        dias: lida.data.dias.map((d) => ({
          dia: d.dia,
          batidas: d.batidas.map(paraPar),
          extra: d.extra ? paraPar(d.extra) : null,
          atestado: d.anotacao === "atestado",
          faltou: d.anotacao === "faltou",
        })),
      },
    };
  }

  async lerAtestado(imagem: ImagemDoCartao): Promise<AtestadoBruto> {
    const lida = respostaAtestado.safeParse(
      await this.chamar(imagem, FERRAMENTA_ATESTADO, INSTRUCAO_ATESTADO),
    );
    return lida.success ? { lido: true, atestado: lida.data } : { lido: false };
  }

  // Devolve o JSON da ferramenta forçada, ou null (rede, status ou resposta sem a ferramenta).
  private async chamar(
    imagem: ImagemDoCartao,
    ferramenta: { name: string },
    instrucao: string,
  ): Promise<unknown> {
    try {
      const r = await this.http(URL_DA_API, {
        method: "POST",
        signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
        headers: {
          "x-api-key": this.chave,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.modelo,
          max_tokens: 4096,
          tools: [ferramenta],
          tool_choice: { type: "tool", name: ferramenta.name },
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: imagem.tipo,
                    data: Buffer.from(imagem.bytes).toString("base64"),
                  },
                },
                { type: "text", text: instrucao },
              ],
            },
          ],
        }),
      });
      if (!r.ok) return null;
      const corpo = (await r.json()) as { content?: { type: string; input?: unknown }[] };
      return corpo.content?.find((c) => c.type === "tool_use")?.input ?? null;
    } catch {
      return null;
    }
  }
}
