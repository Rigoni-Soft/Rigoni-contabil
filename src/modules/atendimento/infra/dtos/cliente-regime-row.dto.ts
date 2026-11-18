import { z } from "zod";

import { REGIMES } from "@/shared/kernel/regimes";

// Linha de `clientes` com só o Regime.
export const clienteRegimeRowSchema = z.object({
  regime: z.enum(REGIMES),
});
