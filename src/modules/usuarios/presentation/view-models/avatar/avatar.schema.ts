import { z } from "zod";

// O FormData da Server Action traz a imagem no campo `foto`. O recorte e o WebP vêm do navegador; o tipo
// e o tamanho de verdade quem confere é o caso de uso, pelos bytes.
export const enviarAvatarSchema = z.object({
  foto: z.instanceof(File, { message: "Escolha uma foto." }),
});
