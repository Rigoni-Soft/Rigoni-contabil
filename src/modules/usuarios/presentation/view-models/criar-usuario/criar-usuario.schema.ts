import { z } from "zod";

export const criarUsuarioSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  email: z.email("E-mail inválido"),
  papel: z.enum(["lider_setor", "funcionario"], "Papel obrigatório"),
  setor: z.string().min(1, "Setor obrigatório"),
});

export type CriarUsuarioFormValues = z.infer<typeof criarUsuarioSchema>;
