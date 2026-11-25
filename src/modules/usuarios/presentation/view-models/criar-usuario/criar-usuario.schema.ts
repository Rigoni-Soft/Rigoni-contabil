import { z } from "zod";

import { SETORES } from "@/shared/kernel/setores";

export const criarUsuarioSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  email: z.email("E-mail inválido"),
  papel: z.enum(["lider_setor", "funcionario"], "Papel obrigatório"),
  setor: z.enum(SETORES, "Setor obrigatório"),
});

export type CriarUsuarioFormValues = z.infer<typeof criarUsuarioSchema>;
