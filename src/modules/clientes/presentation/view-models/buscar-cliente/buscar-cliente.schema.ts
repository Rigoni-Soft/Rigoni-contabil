import { z } from "zod";

// Fonte única do mínimo de caracteres — o
// Container reusa pra decidir quando disparar a busca, sem duplicar o número.
export const TAMANHO_MINIMO_TERMO = 3;

export const buscarClienteSchema = z.object({
  termo: z.string().min(TAMANHO_MINIMO_TERMO, `mínimo de ${TAMANHO_MINIMO_TERMO} caracteres`),
  // true só na busca embutida no dashboard do Simples Nacional —
  // restringe a Regime simples_nacional/mei; demais buscas veem qualquer
  // Cliente.
  apenasSnMei: z.boolean(),
});

export type BuscarClienteInput = z.infer<typeof buscarClienteSchema>;
