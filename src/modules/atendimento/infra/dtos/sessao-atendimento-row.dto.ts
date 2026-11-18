import { z } from "zod";

import { ETAPAS_IDENTIFICACAO } from "@/modules/atendimento/application/dtos/sessao-identificacao.dto";

// Linha de `atendimento_sessoes`: `modo`/`lista` só existem em "alteracao", `pagina` em "alteracao" e "setor" e
// `invalidos` só conta nas etapas da identificação (já é cliente / CNPJ) e em "setor"; as constraints do banco
// garantem esses pares. Sem mapper: o formato já é o de `SessaoAtendimento`, então o parse é devolvido direto.
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
