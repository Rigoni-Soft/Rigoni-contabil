import { z } from "zod";

import { FORMATO_COMPETENCIA, FORMATO_DATA_ISO } from "@/shared/kernel/data-iso";
import { TEXTO_CURTO_MAXIMO } from "@/shared/kernel/texto";

// guid, não uuid: ids do seed não são v4 válidos (ver atribuir-responsavel.actions).
const id = z.guid();
const minuto = z.number().int().min(0).max(1439);
const par = z.object({ entrada: minuto, saida: minuto });
const competencia = z.string().regex(FORMATO_COMPETENCIA);

export const jornadaSchema = z.array(z.number().int().min(0).max(1440)).length(7);

export const cadastrarEmpregadoSchema = z.object({
  clienteId: id,
  nome: z.string().trim().min(1).max(TEXTO_CURTO_MAXIMO),
  jornada: jornadaSchema,
  comissionado: z.boolean().optional(),
});
export const corrigirEmpregadoSchema = z.object({
  empregadoId: id,
  nome: z.string().trim().min(1).max(TEXTO_CURTO_MAXIMO),
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
  data: z.string().regex(FORMATO_DATA_ISO),
  batidas: z.array(par).max(4),
  extra: par.nullable(),
  abono: z.boolean(),
});
