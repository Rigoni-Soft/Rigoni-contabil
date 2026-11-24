import { z } from "zod";

import { FORMAS_ENVIO } from "@/shared/kernel/forma-envio";

export const definirTiposSchema = z.object({
  clienteId: z.guid(),
  contatoId: z.guid(),
  tipos: z.array(z.string().trim().min(1).max(60)).max(12),
  canal: z.enum(FORMAS_ENVIO).optional(),
});
