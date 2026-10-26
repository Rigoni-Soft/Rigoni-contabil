import { z } from "zod";

// Teto de 4,5 MB do corpo de uma Server Action na Vercel (ADR 0007): 4 MB deixa folga para o resto.
const LIMITE_ARQUIVO_BYTES = 4 * 1024 * 1024;

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
    (arquivo) => arquivo.size <= LIMITE_ARQUIVO_BYTES,
    "O arquivo passa de 4 MB. Envie um arquivo menor.",
  );

// Vazio vira ausente: competência e conta só se digitam quando o PDF não pôde ser lido (ou para
// corrigir o que ele traz); o servidor lê o PDF e confere. Segundo anexo na competência e competência já enviada não entram aqui: o banco recusa.
export const anexarGuiaParcelaPgfnSchema = z.object({
  parcelamentoId: z.guid(),
  competencia: opcionalVazio(competencia),
  contaNegociacao: opcionalVazio(
    z.string().max(40, "Conta de negociação: no máximo 40 caracteres."),
  ),
  arquivo: arquivoDaGuia,
});

export const confirmarGuiaParcelaPgfnSchema = z.object({
  parcelamentoId: z.guid(),
  competencia,
});

// Trocar, remover e abrir a guia: a chave é a mesma da guia anexada. A troca refaz a leitura do PDF.
export const guiaDaParcelaPgfnSchema = confirmarGuiaParcelaPgfnSchema;

export const trocarGuiaParcelaPgfnSchema = guiaDaParcelaPgfnSchema.extend({
  arquivo: arquivoDaGuia,
});
