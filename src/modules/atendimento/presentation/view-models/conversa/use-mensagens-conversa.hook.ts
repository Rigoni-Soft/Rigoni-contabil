import { useCallback, useId, useRef, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import {
  conversaKeys,
  useReagirAMensagemMutation,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";
import { useAnexoPendente } from "@/modules/atendimento/presentation/view-models/conversa/use-anexo-pendente.hook";
import { useArrastarArquivo } from "@/modules/atendimento/presentation/view-models/conversa/use-arrastar-arquivo.hook";
import { useConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook";
import { useEmojisRecentes } from "@/modules/atendimento/presentation/view-models/conversa/use-emojis-recentes.hook";
import { useFechaSeletor } from "@/modules/atendimento/presentation/view-models/conversa/use-fecha-seletor.hook";

const PAINEL_ALTURA = 272; // max-h-64 + borda e respiro
const PAINEL_LARGURA = 288; // w-72
const FOLGA = 8;

// O painel é `fixed` (o rolador da conversa cortaria um `absolute`): fica abaixo do botão e, sem
// espaço embaixo, acima; na horizontal, dentro da janela.
function posicaoDoPainel(botao: DOMRect): React.CSSProperties {
  const left = Math.max(FOLGA, Math.min(botao.left, window.innerWidth - PAINEL_LARGURA - FOLGA));
  return window.innerHeight - botao.bottom >= PAINEL_ALTURA
    ? { left, top: botao.bottom + 4 }
    : { left, bottom: window.innerHeight - botao.top + 4 };
}

export function useMensagensConversa(atendimentoId: string, initialData: ConversaVista) {
  const { conversa, transferido } = useConversa(atendimentoId, initialData);
  const reagir = useReagirAMensagemMutation(atendimentoId);
  const pendente = useAnexoPendente(atendimentoId);
  // O envio é da região do campo de resposta: aqui só se sabe pelo cache de mutações.
  const enviandoAnexo = useIsMutating({ mutationKey: conversaKeys.enviarAnexo(atendimentoId) }) > 0;
  // Um seletor aberto por vez: guarda de qual Mensagem e onde o painel fica.
  const [aberta, setAberta] = useState<{ id: string; estilo: React.CSSProperties } | null>(null);
  const [completo, setCompleto] = useState(false);
  const { recentes, recarregar, registrar } = useEmojisRecentes();
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painelId = useId();
  const fechar = useCallback(() => setAberta(null), []);
  useFechaSeletor(aberta !== null, raiz, botao, fechar);

  // Soltar um arquivo sobre a conversa o põe no campo de resposta; encerrado, transferido ou
  // enviando outro arquivo não.
  const arraste = useArrastarArquivo(
    !conversa.encerrado && !transferido && !enviandoAnexo
      ? (arquivo: File) => pendente.anexar(arquivo)
      : undefined,
  );

  return {
    mensagens: conversa.mensagens,
    arraste,
    reacao: {
      // Encerrado ou transferido: a conversa não é mais do usuário.
      ativa: !conversa.encerrado && !transferido,
      abertaId: aberta?.id ?? null,
      estilo: aberta?.estilo,
      completo,
      recentes,
      painelId,
      raizRef: raiz,
      botaoRef: botao,
      erro: reagir.isError ? reagir.error.message : undefined,
      aoAlternar: (mensagemId: string, botaoRect: DOMRect) => {
        if (aberta?.id === mensagemId) return setAberta(null);
        recarregar();
        setCompleto(false);
        setAberta({ id: mensagemId, estilo: posicaoDoPainel(botaoRect) });
      },
      aoExpandir: () => setCompleto(true),
      aoEscolher: (mensagemId: string, emoji: string) => {
        setAberta(null);
        registrar(emoji);
        reagir.mutate({ mensagemId, emoji });
      },
    },
  };
}
