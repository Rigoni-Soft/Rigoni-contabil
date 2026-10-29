import { useQuery } from "@tanstack/react-query";

import { obterConversaAction } from "@/modules/atendimento/presentation/view-models/conversa/conversa.actions";

// A primeira leitura da conversa aberta no centro: as regiões do chat pedem `initialData`, e aqui
// ela não vem do servidor (a conversa não tem rota). Depois disso o polling é o da própria conversa.
export function useConversaAberta(atendimentoId: string | null) {
  return useQuery({
    queryKey: ["atendimento", "conversa-aberta", atendimentoId],
    enabled: atendimentoId !== null,
    queryFn: async () => {
      const resultado = await obterConversaAction(atendimentoId);
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    // Só a carga inicial: guardá-la daria à conversa um `initialData` velho na próxima abertura.
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  });
}
