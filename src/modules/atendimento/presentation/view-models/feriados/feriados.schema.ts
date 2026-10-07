import { z } from "zod";

export const cadastrarFeriadoSchema = z.object({
  data: z.iso.date("Data inválida"),
  descricao: z.string().trim().min(1, "Descrição obrigatória").max(200, "Máximo de 200 caracteres"),
});

export type CadastrarFeriadoFormValues = z.infer<typeof cadastrarFeriadoSchema>;
