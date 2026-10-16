import { z } from "zod";

// input type="date" e <select> desmarcado mandam "" (não undefined) quando vazios —
// aceita "" aqui; o hook (use-feed.hook.ts) remove os campos "" antes de filtrar de verdade.
const dataOuVazio = z.iso.date().or(z.literal(""));
const resultadoOuVazio = z.enum(["sucesso", "falha", "falha_compensacao"]).or(z.literal(""));
// A coluna `ator` é UUID — texto livre (ex. "João") chegaria ao Postgres e viraria erro de query em
// vez de "nenhum resultado". Rejeita aqui, antes da consulta. z.guid(), não z.uuid(): a coluna
// Postgres aceita qualquer literal no formato 8-4-4-4-12 hex, sem exigir os bits de versão/variante
// do RFC 4122 — mesmo padrão dos IDs fixos usados nos testes de integração (ex. "11111111-...").
const atorOuVazio = z.guid("Identificador de ator inválido.").or(z.literal(""));

export const filtroFeedSchema = z
  .object({
    setor: z.string().optional(),
    ator: atorOuVazio.optional(),
    acao: z.string().optional(),
    alvo: z.string().optional(),
    resultado: resultadoOuVazio.optional(),
    dataInicio: dataOuVazio.optional(),
    dataFim: dataOuVazio.optional(),
  })
  .superRefine((v, ctx) => {
    const temInicio = !!v.dataInicio;
    const temFim = !!v.dataFim;

    // Período é as duas pontas juntas ou nenhuma — uma só vira intervalo aberto
    // ambíguo (o usuário quis "a partir de" ou esqueceu a outra data?).
    if (temInicio !== temFim) {
      ctx.addIssue({
        code: "custom",
        message: "Informe as duas datas do período (De e Até).",
        path: [temInicio ? "dataFim" : "dataInicio"],
      });
      return;
    }

    if (temInicio && temFim && v.dataInicio! > v.dataFim!) {
      ctx.addIssue({
        code: "custom",
        message: "O início do período não pode ser depois do fim.",
        path: ["dataFim"],
      });
    }
  });

export type FiltroFeedValues = z.infer<typeof filtroFeedSchema>;
