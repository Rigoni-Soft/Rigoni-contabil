import { z } from "zod";

export const feriadoRowSchema = z.object({
  data: z.iso.date(),
  descricao: z.string(),
});
