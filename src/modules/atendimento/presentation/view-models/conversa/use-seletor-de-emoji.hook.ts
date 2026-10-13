import { useCallback, useId, useRef, useState } from "react";

import { useFechaSeletor } from "@/modules/atendimento/presentation/view-models/conversa/use-fecha-seletor.hook";

const CHAVE_RECENTES = "emojis-recentes";
const MAXIMO_RECENTES = 8;

// Conveniência por navegador (arquitetura: localStorage só para isso); sem storage, lista vazia.
function lerRecentes(): string[] {
  try {
    const lista: unknown = JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? "[]");
    if (!Array.isArray(lista)) return [];
    // O storage é editável: só strings, sem repetidas (viram `key` do botão) e no máximo MAXIMO_RECENTES.
    const textos = lista.filter((e): e is string => typeof e === "string");
    return [...new Set(textos)].slice(0, MAXIMO_RECENTES);
  } catch {
    return [];
  }
}

// UI efêmera do seletor de emoji no campo de resposta (arquitetura.md §4.7).
export function useSeletorDeEmoji() {
  const [aberto, setAberto] = useState(false);
  // Só aparece com o painel aberto (depois da hidratação), então ler o storage aqui não diverge do SSR.
  const [recentes, setRecentes] = useState<string[]>(lerRecentes);
  const campo = useRef<HTMLTextAreaElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painelId = useId();
  const fechar = useCallback(() => setAberto(false), []);

  useFechaSeletor(aberto, raiz, botao, fechar);

  // Insere na posição do cursor (ou no lugar da seleção) e devolve o foco ao campo.
  function escolher(emoji: string) {
    setAberto(false);
    const novos = [emoji, ...recentes.filter((e) => e !== emoji)].slice(0, MAXIMO_RECENTES);
    setRecentes(novos);
    try {
      localStorage.setItem(CHAVE_RECENTES, JSON.stringify(novos));
    } catch {
      // sem storage: só não persiste.
    }
    const area = campo.current;
    if (!area) return;
    area.setRangeText(emoji, area.selectionStart, area.selectionEnd, "end");
    area.focus();
  }

  return {
    campoRef: campo,
    seletor: {
      aberto,
      recentes,
      painelId,
      raizRef: raiz,
      botaoRef: botao,
      onAlternar: () => setAberto((valor) => !valor),
      onEscolher: escolher,
    },
  };
}
