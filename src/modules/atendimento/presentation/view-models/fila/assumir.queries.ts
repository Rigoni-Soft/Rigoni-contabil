import { useMutation, useQueryClient } from "@tanstack/react-query";

import { assumirAtendimentoAction } from "@/modules/atendimento/presentation/view-models/fila/fila.actions";
import { filaKeys } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { meusAtendimentosKeys } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";

// Assumir pelo card. Também no erro ("já assumido"): a Fila relida tira o card de quem perdeu.
export function useAssumirAtendimentoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (atendimentoId: string) => {
      const resultado = await assumirAtendimentoAction(atendimentoId);
      if (!resultado.ok) throw new Error(resultado.error.message);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: filaKeys.todas() }),
        queryClient.invalidateQueries({ queryKey: meusAtendimentosKeys.lista() }),
      ]),
  });
}
