import { z } from "zod";

// guid, não uuid: ids do seed não são v4 válidos (ver atribuir-responsavel.actions).
const id = z.guid();
const minuto = z.number().int().min(0).max(1439);
const par = z.object({ entrada: minuto, saida: minuto });
const competencia = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const jornadaSchema = z.array(z.number().int().min(0).max(1440)).length(7);

export const cadastrarEmpregadoSchema = z.object({
  clienteId: id,
  nome: z.string().trim().min(1).max(120),
  jornada: jornadaSchema,
  comissionado: z.boolean().optional(),
});
export const corrigirEmpregadoSchema = z.object({
  empregadoId: id,
  nome: z.string().trim().min(1).max(120),
  jornada: jornadaSchema,
  comissionado: z.boolean(),
});
export const empregadoAtivoSchema = z.object({ empregadoId: id, ativo: z.boolean() });
export const semMovimentoSchema = z.object({
  empregadoId: id,
  competencia,
  sem: z.boolean(),
});
export const padraoComissionadosSchema = z.object({ clienteId: id, comissionados: z.boolean() });
export const iniciarCartaoSchema = z.object({ empregadoId: id, competencia });
export const salvarDiaSchema = z.object({
  empregadoId: id,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  batidas: z.array(par).max(4),
  extra: par.nullable(),
  abono: z.boolean(),
});
