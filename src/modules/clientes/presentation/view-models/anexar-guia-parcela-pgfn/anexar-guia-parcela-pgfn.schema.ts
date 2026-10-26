import { z } from "zod";

// Teto de 4,5 MB do corpo de uma Server Action na Vercel (ADR 0007): 4 MB deixa folga para o resto.
const LIMITE_ARQUIVO_BYTES = 4 * 1024 * 1024;

const competencia = z
  .string()
  .regex(/^\d{4}(0[1-9]|1[0-2])$/, "Informe o mês e o ano da guia, como 2026-10.");

// Vazio vira ausente: competência e conta só se digitam quando o PDF não pôde ser lido (ou para
// corrigir o que ele traz); o servidor lê o PDF e confere. Segundo anexo na competência e competência já enviada não entram aqui: o banco recusa.
export const anexarGuiaParcelaPgfnSchema = z.object({
  parcelamentoId: z.guid(),
  competencia: z.preprocess(
    (valor) => (typeof valor === "string" ? valor.trim() || undefined : valor),
    competencia.optional(),
  ),
  contaNegociacao: z.preprocess(
    (valor) => (typeof valor === "string" ? valor.trim() || undefined : valor),
    z.string().max(40, "Conta de negociação: no máximo 40 caracteres.").optional(),
  ),
  arquivo: z
    .instanceof(File, { message: "Anexe o PDF da guia." })
    .refine((arquivo) => arquivo.type === "application/pdf", "Envie um arquivo PDF.")
    .refine(
      (arquivo) => arquivo.size <= LIMITE_ARQUIVO_BYTES,
      "O arquivo passa de 4 MB. Envie um arquivo menor.",
    ),
});

export const confirmarGuiaParcelaPgfnSchema = z.object({
  parcelamentoId: z.guid(),
  competencia,
});
