import { z } from "zod";

// guid, não uuid: ids do seed não são v4 válidos (ver atribuir-responsavel.actions).
const id = z.guid();

export const nomeServicoSchema = z.object({ nome: z.string().trim().min(1).max(40) });
export const servicoSchema = z.object({ servicoId: id });
export const marcarSchema = z.object({
  clienteId: id,
  servicoId: id,
  competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  concluido: z.boolean(),
});
export const aplicaSchema = z.object({ clienteId: id, servicoId: id, aplica: z.boolean() });
