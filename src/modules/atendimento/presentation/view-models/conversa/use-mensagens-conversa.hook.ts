import { useCallback, useId, useRef, useState } from "react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useReagirAMensagemMutation } from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";
import { useConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook";
import { useFechaSeletor } from "@/modules/atendimento/presentation/view-models/conversa/use-fecha-seletor.hook";

export function useMensagensConversa(atendimentoId: string, initialData: ConversaVista) {
  const { conversa, transferido } = useConversa(atendimentoId, initialData);
  const reagir = useReagirAMensagemMutation(atendimentoId);
  // Um seletor aberto por vez: guarda de qual Mensagem.
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painelId = useId();
  const fechar = useCallback(() => setAbertaId(null), []);
  useFechaSeletor(abertaId !== null, raiz, botao, fechar);

  return {
    mensagens: conversa.mensagens,
    reacao: {
      // Encerrado ou transferido: a conversa não é mais do usuário.
      ativa: !conversa.encerrado && !transferido,
      abertaId,
      painelId,
      raizRef: raiz,
      botaoRef: botao,
      erro: reagir.isError ? reagir.error.message : undefined,
      aoAlternar: (mensagemId: string) =>
        setAbertaId((atual) => (atual === mensagemId ? null : mensagemId)),
      aoEscolher: (mensagemId: string, emoji: string) => {
        setAbertaId(null);
        reagir.mutate({ mensagemId, emoji });
      },
    },
  };
}
