import { z } from "zod";

import { SETORES } from "@/shared/kernel/setores";
import { contarCaracteres, emojiValido } from "@/shared/kernel/texto";

export const atendimentoIdSchema = z.guid("Atendimento inválido.");

export const enviarDocumentoSchema = z
  .object({
    atendimentoId: atendimentoIdSchema,
    documento: z.object({
      tipo: z.enum(["contrato", "alteracao", "das", "parcelamento", "cnd"]),
      numero: z.number().int().positive().nullable(),
    }),
  })
  .superRefine(({ documento }, ctx) => {
    if ((documento.tipo === "alteracao") !== (documento.numero !== null)) {
      ctx.addIssue({
        code: "custom",
        message: "Só a alteração contratual tem nº.",
        path: ["documento", "numero"],
      });
    }
  });

const RESUMO_TAMANHO_MAXIMO = 1000;

export const transferirAtendimentoSchema = z.object({
  atendimentoId: atendimentoIdSchema,
  setorDestino: z.enum(SETORES, "Escolha o Setor de destino."),
  resumo: z
    .string()
    .trim()
    .min(1, "Informe o resumo do assunto.")
    .max(RESUMO_TAMANHO_MAXIMO, `O resumo aceita até ${RESUMO_TAMANHO_MAXIMO} caracteres.`),
});

export const buscarClienteParaContatoSchema = z.object({
  atendimentoId: atendimentoIdSchema,
  cnpj: z.string().trim().min(1, "Informe o CNPJ.").max(18, "CNPJ inválido."),
});

export const cadastrarContatoUraSchema = z.object({
  atendimentoId: atendimentoIdSchema,
  clienteId: z.guid("Cliente inválido."),
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome do contato.")
    .max(120, "O nome aceita até 120 caracteres."),
  email: z
    .string()
    .trim()
    .max(254, "E-mail inválido.")
    .refine((valor) => valor === "" || z.email().safeParse(valor).success, {
      message: "Informe um e-mail válido.",
    })
    .transform((valor) => (valor === "" ? null : valor)),
});

const MENSAGEM_TAMANHO_MAXIMO = 4096;

export const enviarMensagemSchema = z.object({
  atendimentoId: atendimentoIdSchema,
  texto: z
    .string()
    .trim()
    .min(1, "Escreva a mensagem.")
    .refine((texto) => contarCaracteres(texto) <= MENSAGEM_TAMANHO_MAXIMO, {
      message: `A mensagem aceita até ${MENSAGEM_TAMANHO_MAXIMO} caracteres.`,
    }),
});

export const mensagensAnterioresSchema = z.object({
  atendimentoId: atendimentoIdSchema,
  antes: z.object({
    criadoEm: z.iso.datetime({ offset: true }),
    id: z.guid("Mensagem inválida."),
  }),
});

export const renovarLinksSchema = z.object({
  atendimentoId: atendimentoIdSchema,
  mensagemIds: z.array(z.guid("Mensagem inválida.")).min(1).max(50),
});

export const reagirAMensagemSchema = z.object({
  atendimentoId: atendimentoIdSchema,
  mensagemId: z.guid("Mensagem inválida."),
  emoji: z.string().trim().refine(emojiValido, "Escolha um emoji."),
});

export const enviarAnexoGuardadoSchema = z.object({
  atendimentoId: atendimentoIdSchema,
  caminho: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[\w.-]{1,120}$/i, "Arquivo inválido."),
  nome: z.string().trim().min(1).max(255),
  legenda: z.string().optional(),
});
