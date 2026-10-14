import { z } from "zod";

import { SETORES } from "@/shared/kernel/setores";
import { contarCaracteres, emojiValido } from "@/shared/kernel/texto";

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
  mensagemId: z.guid("Mensagem inválida."),
  emoji: z.string().trim().refine(emojiValido, "Escolha um emoji."),
});

// O arquivo chega em FormData: aqui só o que vem em texto. Tipo e tamanho do arquivo o caso de uso
// confere (a fonte da verdade é o servidor).
// Objeto que o navegador já subiu em partes: `{atendimento}/{uuid}/{nome}`. O caso de uso confere a
// pasta, o tipo e o tamanho no Storage.
export const enviarAnexoGuardadoSchema = z.object({
  atendimentoId: atendimentoIdSchema,
  caminho: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[\w.-]{1,120}$/i, "Arquivo inválido."),
  nome: z.string().trim().min(1).max(255),
});

export const enviarAnexoSchema = z.object({
  atendimentoId: atendimentoIdSchema,
  legenda: z.string().optional(),
});
