import { z } from "zod";

// Linha de `feriados`: `data` é `date` (AAAA-MM-DD). Sem mapper: o formato já é o de `FeriadoDto`.
export const feriadoRowSchema = z.object({
  data: z.iso.date(),
  descricao: z.string(),
});
