import { z } from "zod";

// Linha de `atendimento_sessoes`: `modo`/`pagina`/`lista` só existem em "alteracao" e `invalidos` só
// conta nas etapas de CNPJ (a constraint do banco garante o trio modo/pagina/lista). Sem mapper: o
// formato já é o de `SessaoAtendimento`, então o resultado do parse é devolvido direto.
export const sessaoAtendimentoRowSchema = z.discriminatedUnion("etapa", [
  z.object({
    etapa: z.literal("alteracao"),
    modo: z.enum(["alteracoes", "ambos"]),
    pagina: z.number().int().positive(),
    lista: z.string(),
  }),
  z.object({
    etapa: z.enum(["cnpj", "cnpj_nova_tentativa"]),
    invalidos: z.number().int().nonnegative(),
  }),
  z.object({ etapa: z.enum(["ja_cliente", "tipo_documento"]) }),
]);
