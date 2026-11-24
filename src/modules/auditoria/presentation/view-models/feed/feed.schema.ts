import { z } from "zod";

const dataOuVazio = z.iso.date().or(z.literal(""));
const resultadoOuVazio = z.enum(["sucesso", "falha", "falha_compensacao"]).or(z.literal(""));
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
