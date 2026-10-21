import { z } from "zod";

import { cnpjValido } from "@/shared/kernel/cnpj";
import {
  ERRO_NUMERO_INVALIDO,
  erroDeDuplicidade,
  erroDeFormato,
  outrosNumeros,
} from "@/shared/kernel/numero-alteracao";
import { REGIMES } from "@/shared/kernel/regimes";

// PDF ou DOCX — restringe tanto no `accept` do input (dica do navegador) quanto aqui (não confia
// só no client).
const TIPOS_DOCUMENTO_ACEITOS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const arquivoDocumento = (mensagem: string) =>
  z
    .instanceof(File, { message: mensagem })
    .refine(
      (arquivo) => TIPOS_DOCUMENTO_ACEITOS.includes(arquivo.type),
      "Envie um arquivo PDF ou DOCX",
    );

// Os arquivos vão todos no corpo de uma só Server Action, que o Next corta em 11 MB (next.config.ts).
// Acima disso a requisição falha antes do caso de uso e a tela só diria "verifique a conexão".
const LIMITE_TOTAL_BYTES = 10 * 1024 * 1024;

export const criarClienteSchema = z
  .object({
    empresa: z.string().min(1, "Empresa obrigatória"),
    cnpj: z
      .string({ error: "CNPJ obrigatório" })
      .min(1, "CNPJ obrigatório")
      .refine(cnpjValido, "CNPJ inválido"),
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
            .refine((n) => !erroDeFormato(n), ERRO_NUMERO_INVALIDO),
          data: z.string().min(1, "Data obrigatória"),
          arquivo: arquivoDocumento("Arquivo obrigatório"),
        }),
      )
      // Nº repetido dentro do formulário: barra antes do envio dos arquivos.
      .superRefine((alteracoes, ctx) => {
        alteracoes.forEach(({ numero }, indice) => {
          if (erroDeFormato(numero)) return;
          const erro = erroDeDuplicidade(numero, outrosNumeros(alteracoes, indice));
          if (erro) ctx.addIssue({ code: "custom", message: erro, path: [indice, "numero"] });
        });
      }),
  })
  // Erro do conjunto (`root`), não do Contrato social: o excesso pode vir de qualquer arquivo.
  .superRefine(({ contratoSocial, alteracoesContratuais }, ctx) => {
    const total = [contratoSocial, ...alteracoesContratuais.map((a) => a.arquivo)].reduce(
      (soma, arquivo) => soma + (arquivo?.size ?? 0),
      0,
    );
    if (total <= LIMITE_TOTAL_BYTES) return;
    const mb = (total / (1024 * 1024)).toFixed(1).replace(".", ",");
    ctx.addIssue({
      code: "custom",
      path: ["root"],
      message: `Os arquivos somam ${mb} MB e o limite é 10 MB. Envie arquivos menores ou anexe as alterações depois do cadastro.`,
    });
  });

export type CriarClienteFormValues = z.infer<typeof criarClienteSchema>;
