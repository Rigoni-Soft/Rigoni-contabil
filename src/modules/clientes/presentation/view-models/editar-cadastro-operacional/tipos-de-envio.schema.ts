import { z } from "zod";

// Os tipos do catálogo do Setor (o banco confere) ou "todos"; no máximo uma dúzia por contato.
export const definirTiposSchema = z.object({
  clienteId: z.guid(),
  contatoId: z.guid(),
  tipos: z.array(z.string().trim().min(1).max(60)).max(12),
});
