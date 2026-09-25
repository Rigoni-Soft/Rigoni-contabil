import { z } from "zod";

import { PAPEIS } from "@/modules/usuarios/domain/value-objects/papel.vo";
import { SETORES } from "@/modules/usuarios/domain/value-objects/setor.vo";

export const perfilRowSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string(),
  papel: z.enum(PAPEIS),
  setor: z.enum(SETORES),
  senha_trocada_em: z.string().nullable(),
  senha_provisoria_expira_em: z.string(),
});

export type PerfilRowDto = z.infer<typeof perfilRowSchema>;
