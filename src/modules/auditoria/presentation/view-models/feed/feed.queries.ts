import { useQuery } from "@tanstack/react-query";

import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import { listarRegistrosAction } from "@/modules/auditoria/presentation/view-models/feed/feed.actions";
import type { FiltroFeedValues } from "@/modules/auditoria/presentation/view-models/feed/feed.schema";

export const feedAuditoriaKeys = {
  lista: (filtro: FiltroFeedValues) => ["auditoria", "feed", filtro] as const,
};

export function useFeedAuditoria(filtro: FiltroFeedValues, initialData: RegistroAcaoDto[]) {
  const semFiltro = Object.keys(filtro).length === 0;

  return useQuery({
    queryKey: feedAuditoriaKeys.lista(filtro),
    queryFn: async () => {
      const resultado = await listarRegistrosAction(filtro);
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    initialData: semFiltro ? initialData : undefined,
    staleTime: 30_000,
  });
}
