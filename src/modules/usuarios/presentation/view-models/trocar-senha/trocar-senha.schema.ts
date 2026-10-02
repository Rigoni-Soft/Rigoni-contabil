import { z } from "zod";

export const trocarSenhaSchema = z
  .object({
    novaSenha: z.string().min(8, "Mínimo de 8 caracteres"),
    confirmacao: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((dados) => dados.novaSenha === dados.confirmacao, {
    message: "As senhas não coincidem",
    path: ["confirmacao"],
  });

export type TrocarSenhaFormValues = z.infer<typeof trocarSenhaSchema>;
