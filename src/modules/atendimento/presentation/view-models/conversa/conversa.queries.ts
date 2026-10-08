import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ConversaVista,
  DocumentoDisponivel,
} from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import {
  enviarDocumentoAction,
  obterConversaAction,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.actions";

export const conversaKeys = {
  conversa: (atendimentoId: string) => ["atendimento", "conversa", atendimentoId] as const,
};

// ponytail: polling a cada 5 s para a Mensagem do cliente aparecer; Realtime (`*.realtime.ts`,
// arquitetura.md 4.2) quando o atraso incomodar.
const INTERVALO_MS = 5_000;

export function useConversaQuery(atendimentoId: string, initialData: ConversaVista) {
  return useQuery({
    queryKey: conversaKeys.conversa(atendimentoId),
    queryFn: async () => {
      const resultado = await obterConversaAction(atendimentoId);
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    initialData,
    staleTime: INTERVALO_MS,
    refetchInterval: INTERVALO_MS,
    retry: false,
  });
}

export function useEnviarDocumentoMutation(atendimentoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documento: DocumentoDisponivel) => {
      const resultado = await enviarDocumentoAction({ atendimentoId, documento });
      if (!resultado.ok) throw new Error(resultado.error.message);
    },
    // Também no erro: um envio entregue mas não registrado já deve aparecer (ou não) na conversa.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: conversaKeys.conversa(atendimentoId) }),
  });
}
