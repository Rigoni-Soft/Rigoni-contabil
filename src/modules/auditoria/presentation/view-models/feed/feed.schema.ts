import { z } from "zod";

// input type="date" e <select> desmarcado mandam "" (não undefined) quando vazios —
// aceita "" aqui; o hook (use-feed.hook.ts) remove os campos "" antes de filtrar de verdade.
const dataOuVazio = z.iso.date().or(z.literal(""));
const resultadoOuVazio = z.enum(["sucesso", "falha"]).or(z.literal(""));

export const filtroFeedSchema = z
  .object({
    setor: z.string().optional(),
    ator: z.string().optional(),
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
