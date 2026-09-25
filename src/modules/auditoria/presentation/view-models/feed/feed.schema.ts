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
  .refine((v) => !v.dataInicio || !v.dataFim || v.dataInicio <= v.dataFim, {
    error: "O início do período não pode ser depois do fim.",
    path: ["dataFim"],
  });

export type FiltroFeedValues = z.infer<typeof filtroFeedSchema>;
