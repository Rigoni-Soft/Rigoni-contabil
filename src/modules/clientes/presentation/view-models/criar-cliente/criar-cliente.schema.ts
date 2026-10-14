import { z } from "zod";

import { cnpjValido } from "@/shared/kernel/cnpj";
import { REGIMES } from "@/shared/kernel/regimes";

// PDF ou DOCX (ponto 2 do feedback manual, 2026-09-29) — restringe tanto no
// `accept` do input (dica do navegador) quanto aqui (não confia só no client).
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
  // Opcional (decisão de produto 2026-09-29, atualiza a spec #24).
  contratoSocial: arquivoDocumento("Arquivo inválido").optional(),
  alteracoesContratuais: z.array(
    z.object({
      data: z.string().min(1, "Data obrigatória"),
      arquivo: arquivoDocumento("Arquivo obrigatório"),
    }),
  ),
});

export type CriarClienteFormValues = z.infer<typeof criarClienteSchema>;
