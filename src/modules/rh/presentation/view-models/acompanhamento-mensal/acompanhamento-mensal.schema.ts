import { z } from "zod";

import { FORMATO_COMPETENCIA } from "@/shared/kernel/data-iso";

// guid, não uuid: ids do seed não são v4 válidos (ver atribuir-responsavel.actions).
const id = z.guid();

export const nomeServicoSchema = z.object({ nome: z.string().trim().min(1).max(40) });
export const servicoSchema = z.object({ servicoId: id });
export const marcarSchema = z.object({
  clienteId: id,
  servicoId: id,
  competencia: z.string().regex(FORMATO_COMPETENCIA),
  concluido: z.boolean(),
});
export const aplicaSchema = z.object({
  clienteId: id,
  servicoId: id,
  competencia: marcarSchema.shape.competencia,
  escopo: z.enum(["aplica", "mes", "sempre"]),
});
