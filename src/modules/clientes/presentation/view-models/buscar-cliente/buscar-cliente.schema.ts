import { z } from "zod";

// Fonte única do mínimo de caracteres (critério de aceite do #35) — o
// Container reusa pra decidir quando disparar a busca, sem duplicar o número.
export const TAMANHO_MINIMO_TERMO = 3;

export const buscarClienteSchema = z.object({
  termo: z.string().min(TAMANHO_MINIMO_TERMO, `mínimo de ${TAMANHO_MINIMO_TERMO} caracteres`),
});

export type BuscarClienteInput = z.infer<typeof buscarClienteSchema>;
