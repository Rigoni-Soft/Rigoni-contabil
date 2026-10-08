import { useState } from "react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useEnviarMensagemMutation } from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";
import { useConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook";

export function useCompositor(atendimentoId: string, initialData: ConversaVista) {
  const { conversa, transferido } = useConversa(atendimentoId, initialData);
  const mensagem = useEnviarMensagemMutation(atendimentoId);
  // Muda a cada envio que deu certo: a View usa para esvaziar o campo (falhou, o texto fica).
  const [enviadas, setEnviadas] = useState(0);

  return {
    // Encerrado ou transferido: a conversa não é mais do usuário.
    visivel: !conversa.encerrado && !transferido,
    aoEnviar: (texto: string) =>
      mensagem.mutate(texto, { onSuccess: () => setEnviadas((n) => n + 1) }),
    enviando: mensagem.isPending,
    erro: mensagem.isError ? mensagem.error.message : undefined,
    enviadas,
  };
}
