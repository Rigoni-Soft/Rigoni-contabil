import { useQuery } from "@tanstack/react-query";

import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { listarFilaAction } from "@/modules/atendimento/presentation/view-models/fila/fila.actions";
import type { SetorSlug } from "@/shared/kernel/setores";

export const filaKeys = {
  todas: () => ["atendimento", "fila"] as const,
  setor: (setor: SetorSlug | null) => [...filaKeys.todas(), setor ?? "minha"] as const,
};

const INTERVALO_MS = 15_000;

export function useFilaQuery(
  setor: SetorSlug | null,
  initialData: ItemDaFilaVisto[] | undefined,
  habilitado = true,
) {
  return useQuery({
    queryKey: filaKeys.setor(setor),
    queryFn: async () => {
      const resultado = await listarFilaAction(setor ?? undefined);
      if (!resultado.ok) {
        throw new Error(resultado.error.message, { cause: resultado.error.code });
      }
      return resultado.data;
    },
    initialData,
    enabled: habilitado,
    refetchInterval: (query) =>
      setor === null && query.state.error?.cause === "FORBIDDEN" ? false : INTERVALO_MS,
    staleTime: INTERVALO_MS,
    retry: false,
  });
}
