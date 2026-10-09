import { useQuery } from "@tanstack/react-query";

import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { listarFilaAction } from "@/modules/atendimento/presentation/view-models/fila/fila.actions";

export const filaKeys = {
  // `null` = a Fila do Setor do próprio usuário: a tela, a barra lateral da conversa e o aviso
  // global leem a mesma chave, então viram uma leitura só.
  setor: (setor: string | null) => ["atendimento", "fila", setor ?? "minha"] as const,
};

// ponytail: polling a cada 5 s; entrada, saída e promoção aparecem em até esse tempo. Realtime
// (`*.realtime.ts`, arquitetura.md 4.2) quando o atraso incomodar.
const INTERVALO_MS = 5_000;

export function useFilaQuery(
  setor: string | null,
  initialData: ItemDaFilaVisto[] | undefined,
  habilitado = true,
) {
  return useQuery({
    queryKey: filaKeys.setor(setor),
    queryFn: async () => {
      const resultado = await listarFilaAction(setor ?? undefined);
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    initialData,
    enabled: habilitado,
    // ponytail: a Fila "minha" para de insistir depois de um erro (Admin não tem Setor); volta ao
    // remontar a tela. Distinguir erro transitório de FORBIDDEN quando incomodar.
    refetchInterval: (query) => (setor === null && query.state.error ? false : INTERVALO_MS),
    staleTime: INTERVALO_MS,
    retry: false,
  });
}
