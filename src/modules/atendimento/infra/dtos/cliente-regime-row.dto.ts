import { z } from "zod";

import { REGIMES } from "@/shared/kernel/regimes";

export const clienteRegimeRowSchema = z.object({
  regime: z.enum(REGIMES),
});
