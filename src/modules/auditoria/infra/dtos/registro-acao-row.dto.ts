import { z } from "zod";

import { RESULTADOS_ACAO } from "@/modules/auditoria/domain/value-objects/resultado-acao.vo";

export const registroAcaoRowSchema = z.object({
  id: z.string(),
  ator: z.string(),
  setor: z.string(),
  acao: z.string(),
  alvo: z.string(),
  resultado: z.enum(RESULTADOS_ACAO),
  criado_em: z.string(),
});

export type RegistroAcaoRowDto = z.infer<typeof registroAcaoRowSchema>;
