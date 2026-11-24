import { z } from "zod";

export const enviarAvatarSchema = z.object({
  foto: z.instanceof(File, { message: "Escolha uma foto." }),
});
