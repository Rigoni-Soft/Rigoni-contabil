import { z } from "zod";

const LIMITE_DO_ARQUIVO_DA_GUIA_EM_BYTES = 4 * 1024 * 1024;

const competencia = z
  .string()
  .regex(/^\d{4}(0[1-9]|1[0-2])$/, "Informe o mês e o ano da guia, como 2026-10.");

const opcionalVazio = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (valor) => (typeof valor === "string" ? valor.trim() || undefined : valor),
    schema.optional(),
  );

const arquivoDaGuia = z
  .instanceof(File, { message: "Anexe o PDF da guia." })
  .refine((arquivo) => arquivo.type === "application/pdf", "Envie um arquivo PDF.")
  .refine(
    (arquivo) => arquivo.size <= LIMITE_DO_ARQUIVO_DA_GUIA_EM_BYTES,
    "O arquivo passa de 4 MB. Envie um arquivo menor.",
  );

export const anexarGuiaParcelaPgfnSchema = z.object({
  parcelamentoId: z.guid(),
  competencia: opcionalVazio(competencia),
  contaNegociacao: opcionalVazio(
    z.string().max(40, "Conta de negociação: no máximo 40 caracteres."),
  ),
  arquivo: arquivoDaGuia,
});

export const chaveDaGuiaParcelaPgfnSchema = z.object({
  parcelamentoId: z.guid(),
  competencia,
});

export const confirmarGuiaParcelaPgfnSchema = chaveDaGuiaParcelaPgfnSchema.extend({
  versao: z.string().min(1),
});

export const trocarGuiaParcelaPgfnSchema = chaveDaGuiaParcelaPgfnSchema.extend({
  arquivo: arquivoDaGuia,
});
