import { z } from "zod";

export const cadastroContatoUraRpcSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.enum(["criado", "existente", "email_em_uso"]),
    contato_id: z.guid(),
    nome: z.string(),
  }),
  z.object({ status: z.literal("em_outro_cliente") }),
]);

export const clienteParaConfirmarRowSchema = z.object({
  id: z.guid(),
  empresa: z.string(),
  cnpj: z.string().regex(/^[0-9A-Z]{14}$/),
});
