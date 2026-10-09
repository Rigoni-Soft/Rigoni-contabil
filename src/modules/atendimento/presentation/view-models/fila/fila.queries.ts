import { useQuery } from "@tanstack/react-query";

import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { listarFilaAction } from "@/modules/atendimento/presentation/view-models/fila/fila.actions";

export const filaKeys = {
  setor: (setor: string) => ["atendimento", "fila", setor] as const,
};

// ponytail: polling a cada 5 s; entrada, saída e promoção aparecem em até esse tempo. Realtime
// (`*.realtime.ts`, arquitetura.md 4.2) quando o atraso incomodar.
const INTERVALO_MS = 5_000;

export function useFilaQuery(setor: string, initialData: ItemDaFilaVisto[] | undefined) {
  return useQuery({
    queryKey: filaKeys.setor(setor),
    queryFn: async () => {
      const resultado = await listarFilaAction(setor);
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    initialData,
    refetchInterval: INTERVALO_MS,
    staleTime: INTERVALO_MS,
    retry: false,
  });
}
