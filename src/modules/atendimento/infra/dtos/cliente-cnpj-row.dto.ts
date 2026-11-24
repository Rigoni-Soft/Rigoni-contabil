import { z } from "zod";

import { REGIMES } from "@/shared/kernel/regimes";

export const clienteCnpjRowSchema = z.object({
  cnpj: z.string().regex(/^[0-9A-Z]{14}$/),
  regime: z.enum(REGIMES),
});
