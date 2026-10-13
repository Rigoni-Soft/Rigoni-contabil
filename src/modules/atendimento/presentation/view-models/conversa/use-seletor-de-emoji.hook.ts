import { useEffect, useId, useRef, useState } from "react";

// UI efêmera do seletor de emoji no campo de resposta (arquitetura.md §4.7).
export function useSeletorDeEmoji() {
  const [aberto, setAberto] = useState(false);
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
    const area = campo.current;
    if (!area) return;
    area.setRangeText(emoji, area.selectionStart, area.selectionEnd, "end");
    // setRangeText não dispara `input`: avisa quem escuta o campo.
    area.dispatchEvent(new Event("input", { bubbles: true }));
    area.focus();
  }

  return {
    campoRef: campo,
    seletor: {
      aberto,
      painelId,
      raizRef: raiz,
      botaoRef: botao,
      onAlternar: () => setAberto((valor) => !valor),
      onEscolher: escolher,
    },
  };
}
