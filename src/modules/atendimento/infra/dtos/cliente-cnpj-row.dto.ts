import { z } from "zod";

import { REGIMES } from "@/shared/kernel/regimes";

// Linha de `clientes` com só o CNPJ (14 caracteres `[0-9A-Z]`, sem máscara) e o Regime.
export const clienteCnpjRowSchema = z.object({
  cnpj: z.string().regex(/^[0-9A-Z]{14}$/),
  regime: z.enum(REGIMES),
});
