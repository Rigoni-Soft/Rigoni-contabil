import { z } from "zod";

import { DAS_STATUSES } from "@/shared/kernel/das-status";
import { DOCUMENTO_OBRIGATORIO_STATUSES } from "@/shared/kernel/documento-obrigatorio-status";
import { FORMAS_ENVIO } from "@/shared/kernel/forma-envio";
import { SETORES } from "@/shared/kernel/setores";
import { telefoneAceito } from "@/shared/kernel/telefone";

export const contatoSchema = z
  .object({
    id: z.string().optional(),
    nome: z.string().trim().min(1, "obrigatório"),
    telefone: z.string(),
    telefoneOriginal: z.string().optional(),
    donoSetor: z.string().nullable().optional(),
    email: z
      .string()
      .refine(
        (valor) => !valor.trim() || z.email().safeParse(valor.trim()).success,
        "e-mail inválido",
      ),
  })
  .refine(
    (contato) =>
      !contato.telefone.trim() || telefoneAceito(contato.telefone, contato.telefoneOriginal),
    { message: "Informe o WhatsApp com DDD", path: ["telefone"] },
  )
  .refine((contato) => contato.telefone.trim() || contato.email.trim(), {
    message: "Informe o WhatsApp ou o e-mail",
    path: ["telefone"],
  });

export const editarCadastroOperacionalSchema = z.object({
  clienteId: z.string().uuid(),
  formaEnvio: z.enum(FORMAS_ENVIO),
  contatos: z.array(contatoSchema),
  documentoObrigatorio: z.enum(DOCUMENTO_OBRIGATORIO_STATUSES).nullable(),
  dasStatus: z.enum(DAS_STATUSES).nullable(),
  dataEnvioDas: z.iso.date().nullable(),
  observacoesGerais: z.string().max(2000),
  atividadeMes: z.object({
    industria: z.boolean(),
    comercio: z.boolean(),
    servico: z.boolean(),
  }),
});

const LIMITE_DE_PDFS_POR_ACTION_EM_BYTES = 4 * 1024 * 1024;
const pdfDoAcordo = z
  .instanceof(File, { message: "Anexe o PDF do parcelamento" })
  .refine((arquivo) => arquivo.type === "application/pdf", "Envie um arquivo PDF")
  .refine(
    (arquivo) => arquivo.size <= LIMITE_DE_PDFS_POR_ACTION_EM_BYTES,
    "O arquivo passa de 4 MB",
  );

const somaDosPdfsCabe = (parcelamentos: { arquivo?: File }[]) =>
  parcelamentos.reduce((total, p) => total + (p.arquivo?.size ?? 0), 0) <=
  LIMITE_DE_PDFS_POR_ACTION_EM_BYTES;
const MENSAGEM_SOMA_DOS_PDFS = "Os PDFs novos somam mais de 4 MB. Salve alguns de cada vez.";

export const lerPdfDeParcelamentoSchema = z.object({ clienteId: z.guid(), arquivo: pdfDoAcordo });

const acordoDoPdf = z.object({
  origem: z.enum(["receita_federal", "pgfn"]).nullable(),
  totalDeParcelas: z.number().nullable(),
  valorDaParcelaCentavos: z.number().nullable(),
  dataDeAdesao: z.string().nullable(),
});

const parcelasRestantes = z
  .number({ error: "obrigatório" })
  .int("número inteiro")
  .min(1, "Informe 1 ou mais parcelas");

const codigoDoParcelamento = z.string().trim().max(60, "máximo 60 caracteres");

export const salvarParcelamentosSchema = z.object({
  clienteId: z.guid(),
  setor: z.enum(SETORES),
  parcelamentos: z
    .array(
      z.object({
        id: z.guid().optional(),
        codigo: codigoDoParcelamento,
        parcelasRestantes: z.number().int("número inteiro").min(0),
        interno: z.boolean(),
        arquivo: pdfDoAcordo.optional(),
        acordo: acordoDoPdf.optional(),
      }),
    )
    .refine(somaDosPdfsCabe, MENSAGEM_SOMA_DOS_PDFS),
});

const parcelamentoFormSchema = z
  .object({
    id: z.string().optional(),
    codigo: codigoDoParcelamento,
    parcelasRestantes: z.number({ error: "obrigatório" }),
    interno: z.boolean(),
    quitado: z.boolean(),
    temEnvio: z.boolean(),
    enviadoNoMes: z.boolean(),
    arquivoNome: z.string(),
    arquivo: z.instanceof(File).optional(),
    guia: pdfDoAcordo.optional(),
    acordo: acordoDoPdf.optional(),
  })
  .superRefine((p, ctx) => {
    const regras = [
      ...(p.quitado
        ? []
        : [["parcelasRestantes", parcelasRestantes.safeParse(p.parcelasRestantes)] as const]),
      ...(p.id ? [] : [["arquivo", pdfDoAcordo.safeParse(p.arquivo)] as const]),
    ];
    for (const [campo, resultado] of regras) {
      if (!resultado.success) {
        ctx.addIssue({ code: "custom", path: [campo], message: resultado.error.issues[0].message });
      }
    }
  });
export type ParcelamentoFormValues = z.infer<typeof parcelamentoFormSchema>;

export const parcelamentosFormSchema = z
  .array(parcelamentoFormSchema)
  .refine(somaDosPdfsCabe, MENSAGEM_SOMA_DOS_PDFS);

export const editarCadastroOperacionalFormSchema = editarCadastroOperacionalSchema
  .omit({ clienteId: true })
  .extend({
    responsavelId: z.string(),
    parcelamentos: parcelamentosFormSchema,
  });
type ValoresDoSchema = z.infer<typeof editarCadastroOperacionalFormSchema>;
export type EditarCadastroOperacionalFormValues = Omit<ValoresDoSchema, "contatos"> & {
  contatos: (Omit<ValoresDoSchema["contatos"][number], "telefoneOriginal"> & {
    tipos?: string[];
    canal?: string;
    setores?: readonly string[];
  })[];
};
