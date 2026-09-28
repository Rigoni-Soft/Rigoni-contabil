import { z } from "zod";

import { REGIMES } from "@/shared/kernel/regimes";

export const criarClienteSchema = z.object({
  empresa: z.string().min(1, "Empresa obrigatória"),
  cnpj: z.string().min(1, "CNPJ obrigatório"),
  regime: z.enum(REGIMES, "Regime obrigatório"),
  contratoSocial: z.instanceof(File, { message: "Contrato social obrigatório" }),
  alteracoesContratuais: z.array(
    z.object({
      data: z.string().min(1, "Data obrigatória"),
      arquivo: z.instanceof(File, { message: "Arquivo obrigatório" }),
    }),
  ),
});

export type CriarClienteFormValues = z.infer<typeof criarClienteSchema>;
