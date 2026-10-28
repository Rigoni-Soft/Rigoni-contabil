import { useQuery } from "@tanstack/react-query";

import { listarAtendimentosDaEquipeAction } from "@/modules/atendimento/presentation/view-models/equipe/equipe.actions";
import type { SetorSlug } from "@/shared/kernel/setores";

// ponytail: polling a cada 15 s, como "Meus atendimentos". Realtime quando o atraso incomodar.
const INTERVALO_MS = 15_000;

// `setor` null desliga a leitura (quem não supervisiona).
export function useEquipeQuery(setor: SetorSlug | null) {
  return useQuery({
    queryKey: ["atendimento", "equipe", setor],
    queryFn: async () => {
      const resultado = await listarAtendimentosDaEquipeAction(setor ?? undefined);
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    enabled: setor !== null,
    refetchInterval: INTERVALO_MS,
    staleTime: INTERVALO_MS,
    retry: false,
  });
}
