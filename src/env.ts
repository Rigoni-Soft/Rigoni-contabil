import "server-only";

import { z } from "zod";

const resultado = z
  .object({
    PORT: z.coerce.number().int(),
  })
  .safeParse({
    PORT: process.env.PORT,
  });

if (!resultado.success) {
  throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(resultado.error)}`);
}

export const { PORT } = resultado.data;
