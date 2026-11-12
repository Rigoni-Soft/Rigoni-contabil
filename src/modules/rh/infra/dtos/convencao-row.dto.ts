import { z } from "zod";

import { CHAVES_NUMERICAS, MOTIVOS_DE_REJEICAO } from "@/shared/kernel/regras-da-convencao";

// Linha de `rh_convencoes` e o jsonb `regras` (esquema fechado de kernel/regras-da-convencao). O banco já
// confere a forma no CHECK; aqui o formato vira tipo, e uma linha fora do esquema falha alto.

const citacao = { clausula: z.string(), trecho: z.string() };

const regraNumerica = z.object({
  ...citacao,
  chave: z.enum(CHAVES_NUMERICAS),
  valor: z.number(),
});
const regraDeDatas = z.object({
  ...citacao,
  chave: z.literal("datas_especiais"),
  valor: z.array(
    z.object({
      descricao: z.string(),
      data: z.string().nullable(),
      percentual: z.number(),
      percentualComissionado: z.number().optional(),
    }),
  ),
});
const regraDeFeriado = z.object({
  ...citacao,
  chave: z.literal("excecoes_de_feriado"),
  valor: z.array(z.object({ descricao: z.string() })),
});

const regras = z.object({
  versao: z.number(),
  aplicadas: z.array(z.union([regraNumerica, regraDeDatas, regraDeFeriado])),
  rejeitadas: z.array(
    z.object({
      chave: z.string(),
      motivo: z.enum(MOTIVOS_DE_REJEICAO),
    }),
  ),
});

export const convencaoRowSchema = z.object({
  id: z.guid(),
  sindicato: z.string(),
  vigencia_inicio: z.iso.date(),
  vigencia_fim: z.iso.date(),
  arquivo_nome: z.string(),
  criado_em: z.string(),
  regras,
});
