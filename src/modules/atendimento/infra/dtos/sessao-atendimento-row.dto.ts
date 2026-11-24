import { z } from "zod";

import { ETAPAS_IDENTIFICACAO } from "@/modules/atendimento/application/dtos/sessao-identificacao.dto";

export const sessaoAtendimentoRowSchema = z.discriminatedUnion("etapa", [
  z.object({
    etapa: z.literal("alteracao"),
    modo: z.enum(["alteracoes", "ambos"]),
    pagina: z.number().int().positive(),
    lista: z.string(),
  }),
  z.object({
    etapa: z.enum(ETAPAS_IDENTIFICACAO),
    invalidos: z.number().int().nonnegative(),
  }),
  z.object({
    etapa: z.literal("setor"),
    pagina: z.number().int().positive(),
    invalidos: z.number().int().nonnegative(),
  }),
  z.object({ etapa: z.literal("tipo_documento") }),
]);
