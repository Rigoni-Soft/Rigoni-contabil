import { useQuery } from "@tanstack/react-query";

import { obterConversaAction } from "@/modules/atendimento/presentation/view-models/conversa/conversa.actions";

export function useConversaAberta(atendimentoId: string | null) {
  return useQuery({
    queryKey: ["atendimento", "conversa-aberta", atendimentoId],
    enabled: atendimentoId !== null,
    queryFn: async () => {
      const resultado = await obterConversaAction(atendimentoId);
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  });
}
