import { useQuery } from "@tanstack/react-query";

import { listarMeusAtendimentosAction } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.actions";
import { meusAtendimentosKeys } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.keys";

// ponytail: polling a cada 15 s; um Atendimento novo aparece em até esse tempo. Realtime
// (`*.realtime.ts`, arquitetura.md 4.2) quando o tempo de espera incomodar.
const INTERVALO_MS = 15_000;

export function useMeusAtendimentosQuery(habilitado: boolean) {
  return useQuery({
    queryKey: meusAtendimentosKeys.lista(),
    queryFn: async () => {
      const resultado = await listarMeusAtendimentosAction();
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    enabled: habilitado,
    refetchInterval: INTERVALO_MS,
    staleTime: INTERVALO_MS,
    // Sessão expirada não melhora tentando de novo; o próximo ciclo tenta outra vez.
    retry: false,
  });
}
