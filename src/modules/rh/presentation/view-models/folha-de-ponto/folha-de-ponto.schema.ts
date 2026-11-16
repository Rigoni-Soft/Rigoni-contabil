import { z } from "zod";

import { FORMATO_COMPETENCIA, FORMATO_DATA_ISO } from "@/shared/kernel/data-iso";
import { LIMITE_DA_FOTO_BYTES } from "@/shared/kernel/foto-do-ponto";
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

// A foto do cartão e a do atestado seguem o mesmo critério (JPEG ou PNG, até o limite do domínio); só a
// mensagem de "falta a foto" cita o documento. Os Containers usam estes schemas para o aviso imediato e a
// Server Action os repete: o servidor continua sendo a barreira (o use case confere a assinatura do arquivo).
export const MENSAGEM_FOTO_GRANDE = "A foto passa de 4 MB.";
export const MENSAGEM_SEM_FOTO = "Escolha a foto do cartão (JPEG ou PNG).";
export const MENSAGEM_SEM_ATESTADO = "Escolha a foto do atestado (JPEG ou PNG).";
const fotoCom = (semFoto: string) =>
  z
    .instanceof(File, { error: semFoto })
    .refine((f) => f.size > 0, semFoto)
    .refine((f) => f.type === "image/jpeg" || f.type === "image/png", semFoto)
    .refine((f) => f.size <= LIMITE_DA_FOTO_BYTES, MENSAGEM_FOTO_GRANDE);
export const fotoDoCartaoSchema = fotoCom(MENSAGEM_SEM_FOTO);
export const fotoDoAtestadoSchema = fotoCom(MENSAGEM_SEM_ATESTADO);
// Aviso imediato no navegador: a mensagem da foto escolhida que não serve (ou da falta dela), ou undefined.
export function recusaDaFoto(
  schema: typeof fotoDoCartaoSchema,
  foto: File | undefined,
): string | undefined {
  const lida = schema.safeParse(foto);
  return lida.success ? undefined : lida.error.issues[0]?.message;
}
export const lerCartaoSchema = z.object({
  clienteId: id,
  competencia,
  quinzena: z.enum(["1", "2"]).transform((q): 1 | 2 => (q === "1" ? 1 : 2)),
  imagem: fotoDoCartaoSchema,
});
export const lerAtestadoSchema = z.object({ empregadoId: id, imagem: fotoDoAtestadoSchema });
export const baixarPdfDoCartaoSchema = z.object({ clienteId: id, empregadoId: id, competencia });
