import { z } from "zod";

import { FORMAS_ENVIO } from "@/shared/kernel/forma-envio";

const TAMANHO_MAXIMO_DO_SLUG_DE_TIPO = 60;
const MAXIMO_DE_TIPOS_POR_CONTATO = 12;

export const definirTiposSchema = z.object({
  clienteId: z.guid(),
  contatoId: z.guid(),
  tipos: z
    .array(z.string().trim().min(1).max(TAMANHO_MAXIMO_DO_SLUG_DE_TIPO))
    .max(MAXIMO_DE_TIPOS_POR_CONTATO),
  canal: z.enum(FORMAS_ENVIO).optional(),
});
