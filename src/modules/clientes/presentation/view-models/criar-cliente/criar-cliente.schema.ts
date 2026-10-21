import { z } from "zod";

import { cnpjValido } from "@/shared/kernel/cnpj";
import {
  ERRO_NUMERO_INVALIDO,
  erroDoNumero,
  NUMERO_MAXIMO,
} from "@/shared/kernel/numero-alteracao";
import { REGIMES } from "@/shared/kernel/regimes";

// PDF ou DOCX — restringe tanto no `accept` do input (dica do navegador) quanto aqui (não confia
// só no client).
const TIPOS_DOCUMENTO_ACEITOS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const arquivoDocumento = (mensagem: string) =>
  z
    .instanceof(File, { message: mensagem })
    .refine(
      (arquivo) => TIPOS_DOCUMENTO_ACEITOS.includes(arquivo.type),
      "Envie um arquivo PDF ou DOCX",
    );

export const criarClienteSchema = z.object({
  empresa: z.string().min(1, "Empresa obrigatória"),
  cnpj: z.string().min(1, "CNPJ obrigatório").refine(cnpjValido, "CNPJ inválido"),
  regime: z.enum(REGIMES, "Regime obrigatório"),
  // Opcional: vazio vale como "sem e-mail" (campo de texto não preenchido chega como "").
  email: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .max(254, "Use até 254 caracteres")
        .email("Informe um e-mail válido, como nome@empresa.com.br"),
    ])
    .optional(),
  // Opcional.
  contratoSocial: arquivoDocumento("Arquivo inválido").optional(),
  alteracoesContratuais: z
    .array(
      z.object({
        numero: z
          .number({ error: "Nº obrigatório" })
          .int(ERRO_NUMERO_INVALIDO)
          .positive(ERRO_NUMERO_INVALIDO)
          .max(NUMERO_MAXIMO, ERRO_NUMERO_INVALIDO),
        data: z.string().min(1, "Data obrigatória"),
        arquivo: arquivoDocumento("Arquivo obrigatório"),
      }),
    )
    // Nº repetido dentro do formulário: barra antes do envio dos arquivos.
    .superRefine((alteracoes, ctx) => {
      alteracoes.forEach(({ numero }, indice) => {
        if (!Number.isInteger(numero)) return;
        const outros = alteracoes.filter((_, i) => i !== indice).map((o) => o.numero);
        const erro = erroDoNumero(numero, outros);
        if (erro) ctx.addIssue({ code: "custom", message: erro, path: [indice, "numero"] });
      });
    }),
});

export type CriarClienteFormValues = z.infer<typeof criarClienteSchema>;
