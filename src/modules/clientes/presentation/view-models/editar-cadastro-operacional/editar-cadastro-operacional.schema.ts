import { z } from "zod";

import { DAS_STATUSES } from "@/shared/kernel/das-status";
import { DOCUMENTO_OBRIGATORIO_STATUSES } from "@/shared/kernel/documento-obrigatorio-status";
import { FORMAS_ENVIO } from "@/shared/kernel/forma-envio";

export const editarCadastroOperacionalSchema = z.object({
  clienteId: z.string().uuid(),
  formaEnvio: z.enum(FORMAS_ENVIO),
  contatos: z.array(
    z.object({
      id: z.string().optional(),
      nome: z.string().min(1, "obrigatório"),
      telefone: z.string().min(1, "obrigatório"),
      padrao: z.boolean(),
    }),
  ),
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

// Teto de 4,5 MB do corpo de uma Server Action na Vercel (ADR 0007): 4 MB deixa folga para o resto.
// ponytail: o bucket aceita 10 MiB; acima de 4 MB o upload em partes direto ao Storage (ADR 0007)
// exigiria política de usuário no bucket, que este ticket proíbe.
const LIMITE_PDF_BYTES = 4 * 1024 * 1024;
const pdfDoAcordo = z
  .instanceof(File, { message: "Anexe o PDF do parcelamento" })
  .refine((arquivo) => arquivo.type === "application/pdf", "Envie um arquivo PDF")
  .refine((arquivo) => arquivo.size <= LIMITE_PDF_BYTES, "O arquivo passa de 4 MB");

// Leitura do PDF na tela: só o arquivo, com as mesmas regras do anexo.
export const lerPdfDeParcelamentoSchema = z.object({ arquivo: pdfDoAcordo });

const parcelasRestantes = z
  .number({ error: "obrigatório" })
  .int("número inteiro")
  .min(1, "Informe 1 ou mais parcelas");

const codigoDoParcelamento = z
  .string()
  .trim()
  .min(1, "obrigatório")
  .max(60, "máximo 60 caracteres");

// Parcelamentos vão por Server Action própria (têm arquivo): o cadastro operacional não os carrega.
export const salvarParcelamentosSchema = z.object({
  clienteId: z.guid(),
  parcelamentos: z.array(
    z.object({
      id: z.guid().optional(),
      codigo: codigoDoParcelamento,
      // 0 vem do quitado, que volta intacto; o mínimo de 1 nos demais é do caso de uso e do banco.
      parcelasRestantes: z.number().int("número inteiro").min(0),
      interno: z.boolean(),
      arquivo: pdfDoAcordo.optional(),
    }),
  ),
});

// Linha do formulário: além do que se grava, traz o que a tela só exibe (selo, quitado, nome do PDF).
export const parcelamentoFormSchema = z
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
  })
  .superRefine((p, ctx) => {
    // Mesmas regras da Server Action; quitado não se edita (o zero é do sistema) e o PDF só vale no novo.
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

export type EditarCadastroOperacionalInput = z.infer<typeof editarCadastroOperacionalSchema>;

// clienteId nunca é digitado pelo Funcionário — vem do parâmetro da rota (Container injeta antes de
// chamar a Server Action). Removê-lo do resolver do formulário evita depender de um input escondido
// só pra carregar um valor que o React Hook Form já não precisa validar no cliente. responsavelId
// vai por outra Server Action (só o Líder do SN atribui) — aqui só viaja no formulário; o schema da
// action de edição o descarta.
export const editarCadastroOperacionalFormSchema = editarCadastroOperacionalSchema
  .omit({ clienteId: true })
  .extend({ responsavelId: z.string(), parcelamentos: z.array(parcelamentoFormSchema) });
export type EditarCadastroOperacionalFormValues = z.infer<
  typeof editarCadastroOperacionalFormSchema
>;
