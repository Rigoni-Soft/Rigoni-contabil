import { z } from "zod";

import { cnpjValido } from "@/shared/kernel/cnpj";
import { hojeIso } from "@/shared/kernel/mes-atual";
import {
  ERRO_NUMERO_INVALIDO,
  erroDeDuplicidade,
  erroDeFormato,
  outrosNumeros,
} from "@/shared/kernel/numero-alteracao";
import { REGIMES } from "@/shared/kernel/regimes";

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

const ERRO_DATA_FUTURA = "A data da alteração não pode ser futura.";

export const dataNaoFutura = z.iso
  .date({ error: (i) => (i.input === "" ? "Data obrigatória" : "Data inválida") })
  .refine((data) => data <= hojeIso(), ERRO_DATA_FUTURA);

const LIMITE_TOTAL_BYTES = 10 * 1024 * 1024;

export const criarClienteSchema = z
  .object({
    empresa: z.string().min(1, "Empresa obrigatória"),
    cnpj: z
      .string({ error: "CNPJ obrigatório" })
      .min(1, "CNPJ obrigatório")
      .refine(cnpjValido, "CNPJ inválido"),
    regime: z.enum(REGIMES, "Regime obrigatório"),
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
    contratoSocial: arquivoDocumento("Arquivo inválido").optional(),
    alteracoesContratuais: z
      .array(
        z.object({
          numero: z
            .number({ error: "Nº obrigatório" })
            .refine((n) => !erroDeFormato(n), ERRO_NUMERO_INVALIDO),
          data: dataNaoFutura,
          arquivo: arquivoDocumento("Arquivo obrigatório"),
        }),
      )
      .superRefine((alteracoes, ctx) => {
        alteracoes.forEach(({ numero }, indice) => {
          if (erroDeFormato(numero)) return;
          const erro = erroDeDuplicidade(numero, outrosNumeros(alteracoes, indice));
          if (erro) ctx.addIssue({ code: "custom", message: erro, path: [indice, "numero"] });
        });
      }),
  })
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
