import { z } from "zod";

import { SETORES } from "@/shared/kernel/setores";
import { contarCaracteres } from "@/shared/kernel/texto";

// z.guid(), não z.uuid(): mesmo critério do feed de auditoria (a coluna aceita qualquer 8-4-4-4-12).
export const atendimentoIdSchema = z.guid("Atendimento inválido.");

// Contrato social não tem data; alteração contratual tem (AAAA-MM-DD).
export const enviarDocumentoSchema = z
  .object({
    atendimentoId: atendimentoIdSchema,
    documento: z.object({
      tipo: z.enum(["contrato", "alteracao"]),
      data: z.iso.date().nullable(),
    }),
  })
  .superRefine(({ documento }, ctx) => {
    if ((documento.tipo === "alteracao") !== (documento.data !== null)) {
      ctx.addIssue({
        code: "custom",
        message: "Só a alteração contratual tem data.",
        path: ["documento", "data"],
      });
    }
  });

export const RESUMO_TAMANHO_MAXIMO = 1000; // o mesmo limite do caso de uso e da tabela `transferencias`

export const transferirAtendimentoSchema = z.object({
  atendimentoId: atendimentoIdSchema,
  setorDestino: z.enum(SETORES, "Escolha o Setor de destino."),
  resumo: z
    .string()
    .trim()
    .min(1, "Informe o resumo do assunto.")
    .max(RESUMO_TAMANHO_MAXIMO, `O resumo aceita até ${RESUMO_TAMANHO_MAXIMO} caracteres.`),
});

const MENSAGEM_TAMANHO_MAXIMO = 4096; // o mesmo limite do caso de uso (texto do WhatsApp)

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

export const reagirAMensagemSchema = z.object({
  atendimentoId: atendimentoIdSchema,
  mensagemId: z.string().min(1),
  emoji: z.string().trim().min(1, "Escolha um emoji.").max(16),
});
