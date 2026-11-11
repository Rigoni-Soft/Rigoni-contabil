import { z } from "zod";

// guid, não uuid: ids do seed não são v4 válidos (ver atribuir-responsavel.actions).
const id = z.guid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// O corpo de uma Server Action na Vercel não passa de 4,5 MB (ADR 0007): o PDF entra por ela até 4 MB.
export const LIMITE_DO_PDF = 4 * 1024 * 1024;

export const enviarConvencaoSchema = z.object({
  clienteId: id,
  sindicato: z.string().trim().min(1).max(120),
  vigenciaInicio: data,
  vigenciaFim: data,
  arquivo: z
    .instanceof(File)
    .refine((f) => f.size > 0, "Escolha o PDF da convenção.")
    .refine((f) => f.size <= LIMITE_DO_PDF, "O PDF passa de 4 MB."),
});

export const interruptoresSchema = z.object({
  clienteId: id,
  bancoDeHoras: z.boolean(),
  trabalhoAosDomingos: z.boolean(),
});

export const convencaoDoEmpregadoSchema = z.object({
  empregadoId: id,
  sindicato: z.string().trim().min(1).max(120).nullable(),
});
