import { useEffect, useId, useRef, useState } from "react";

const CHAVE_RECENTES = "emojis-recentes";
const MAXIMO_RECENTES = 8;

// Conveniência por navegador (arquitetura: localStorage só para isso); sem storage, lista vazia.
function lerRecentes(): string[] {
  try {
    const lista: unknown = JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? "[]");
    return Array.isArray(lista) ? lista.filter((e) => typeof e === "string") : [];
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

  // Aberto: Esc (de qualquer foco) e clique fora fecham.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;
      setAberto(false);
      botao.current?.focus();
    };
    const aoClicar = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("pointerdown", aoClicar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("pointerdown", aoClicar);
    };
  }, [aberto]);

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
