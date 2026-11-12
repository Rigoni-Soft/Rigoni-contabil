import { z } from "zod";

import { FORMATO_DATA_ISO } from "@/shared/kernel/data-iso";
import { NOME_DO_ARQUIVO_MAXIMO, TEXTO_CURTO_MAXIMO } from "@/shared/kernel/texto";

// guid, não uuid: ids do seed não são v4 válidos (ver atribuir-responsavel.actions).
const id = z.guid();
const data = z.string().regex(FORMATO_DATA_ISO);

// O corpo de uma Server Action na Vercel não passa de 4,5 MB (ADR 0007): o PDF entra por ela até 4 MB.
export const LIMITE_DO_PDF = 4 * 1024 * 1024;
export const MENSAGEM_PDF_GRANDE = "O PDF passa de 4 MB.";
export const MENSAGEM_NOME_LONGO = `O nome do arquivo passa de ${NOME_DO_ARQUIVO_MAXIMO} caracteres.`;

export const enviarConvencaoSchema = z.object({
  clienteId: id,
  sindicato: z.string().trim().min(1).max(TEXTO_CURTO_MAXIMO),
  vigenciaInicio: data,
  vigenciaFim: data,
  arquivo: z
    .instanceof(File)
    .refine((f) => f.size > 0, "Escolha o PDF da convenção.")
    .refine((f) => f.size <= LIMITE_DO_PDF, MENSAGEM_PDF_GRANDE)
    .refine((f) => f.name.trim().length <= NOME_DO_ARQUIVO_MAXIMO, MENSAGEM_NOME_LONGO),
});

export const interruptoresSchema = z.object({
  clienteId: id,
  bancoDeHoras: z.boolean(),
  trabalhoAosDomingos: z.boolean(),
});

export const convencaoDoEmpregadoSchema = z.object({
  empregadoId: id,
  sindicato: z.string().trim().min(1).max(TEXTO_CURTO_MAXIMO).nullable(),
});
