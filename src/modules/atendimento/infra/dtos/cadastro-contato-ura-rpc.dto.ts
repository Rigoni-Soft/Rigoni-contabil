import { z } from "zod";

// O que `cadastrar_contato_ura` devolve (jsonb); o `status` decide o que a tela mostra.
export const cadastroContatoUraRpcSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("criado"), contato_id: z.guid(), nome: z.string() }),
  z.object({ status: z.literal("existente"), contato_id: z.guid(), nome: z.string() }),
  z.object({ status: z.literal("email_em_uso"), contato_id: z.guid(), nome: z.string() }),
  z.object({ status: z.literal("em_outro_cliente") }),
]);

// Linha de `clientes` lida só para o Cliente que a Recepção confirma.
export const clienteParaConfirmarRowSchema = z.object({
  id: z.guid(),
  empresa: z.string(),
  cnpj: z.string().regex(/^[0-9A-Z]{14}$/),
});
