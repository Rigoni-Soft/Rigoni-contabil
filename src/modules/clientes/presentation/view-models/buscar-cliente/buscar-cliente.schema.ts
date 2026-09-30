import { z } from "zod";

export const buscarClienteSchema = z.object({
  termo: z.string().min(3, "mínimo de 3 caracteres"),
});

export type BuscarClienteInput = z.infer<typeof buscarClienteSchema>;
