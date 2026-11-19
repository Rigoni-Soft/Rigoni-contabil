import { z } from "zod";

import { FORMAS_ENVIO } from "@/shared/kernel/forma-envio";

// Os tipos do catálogo do Setor (o banco confere) ou "todos"; no máximo uma dúzia por contato. O canal só
// vale para o contato com os dois canais (o banco exige a escolha nesse caso e ignora nos demais).
export const definirTiposSchema = z.object({
  clienteId: z.guid(),
  contatoId: z.guid(),
  tipos: z.array(z.string().trim().min(1).max(60)).max(12),
  canal: z.enum(FORMAS_ENVIO).optional(),
});
