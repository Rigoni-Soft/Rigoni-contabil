import { z } from "zod";

import { ETAPAS_IDENTIFICACAO } from "@/modules/atendimento/application/ports/out/sessao-atendimento.provider";

// Linha de `atendimento_sessoes`: `modo`/`pagina`/`lista` só existem em "alteracao" e `invalidos` só conta
// nas etapas da identificação (já é cliente / CNPJ); a constraint do banco garante o trio
// modo/pagina/lista. Sem mapper: o formato já é o de `SessaoAtendimento`, então o parse é devolvido direto.
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
  z.object({ etapa: z.literal("tipo_documento") }),
]);
