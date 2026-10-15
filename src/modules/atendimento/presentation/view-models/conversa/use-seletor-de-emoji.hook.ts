import { useCallback, useId, useRef, useState } from "react";

import { useEmojisRecentes } from "@/modules/atendimento/presentation/view-models/conversa/use-emojis-recentes.hook";
import { useFechaSeletor } from "@/modules/atendimento/presentation/view-models/conversa/use-fecha-seletor.hook";

// UI efêmera do seletor de emoji no campo de resposta (arquitetura.md §4.7).
export function useSeletorDeEmoji() {
  const [aberto, setAberto] = useState(false);
  // Com recentes o seletor mostra só a linha deles; "ver todos" abre as categorias.
  const [completo, setCompleto] = useState(false);
  const { recentes, recarregar, registrar } = useEmojisRecentes();
  const campo = useRef<HTMLTextAreaElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painelId = useId();
  const fechar = useCallback(() => setAberto(false), []);

  useFechaSeletor(aberto, raiz, botao, fechar);

  // Insere na posição do cursor (ou no lugar da seleção) e devolve o foco ao campo.
  function escolher(emoji: string) {
    setAberto(false);
    registrar(emoji);
    const area = campo.current;
    if (!area) return;
    area.setRangeText(emoji, area.selectionStart, area.selectionEnd, "end");
    area.focus();
  }

  return {
    campoRef: campo,
    seletor: {
      aberto,
      completo,
      recentes,
      painelId,
      raizRef: raiz,
      botaoRef: botao,
      onAlternar: () => {
        if (!aberto) {
          recarregar();
          setCompleto(false);
        }
        setAberto((valor) => !valor);
      },
      onExpandir: () => setCompleto(true),
      onEscolher: escolher,
    },
  };
}
