import { z } from "zod";

export const TAMANHO_MINIMO_TERMO = 3;

export const buscarClienteSchema = z.object({
  termo: z.string().min(TAMANHO_MINIMO_TERMO, `mínimo de ${TAMANHO_MINIMO_TERMO} caracteres`),
  apenasSnMei: z.boolean(),
});

export type BuscarClienteInput = z.infer<typeof buscarClienteSchema>;
