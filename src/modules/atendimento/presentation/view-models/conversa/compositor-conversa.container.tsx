"use client";

import { useEffect, useRef, useState } from "react";

import { CompositorDeMensagem } from "@/presentation/components/organisms/compositor-de-mensagem.component";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useCompositor } from "@/modules/atendimento/presentation/view-models/conversa/use-compositor.hook";

export function CompositorConversaContainer({
  atendimentoId,
  initialData,
}: {
  atendimentoId: string;
  initialData: ConversaVista;
}) {
  const { visivel, aoEnviar, enviando, erro, enviadas } = useCompositor(atendimentoId, initialData);

  // UI efêmera do seletor de emoji (arquitetura.md §4.7): estado e refs ficam no Container.
  const [emojiAberto, setEmojiAberto] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const seletor = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!emojiAberto) return;
    const foraDoSeletor = (evento: PointerEvent) => {
      if (!seletor.current?.contains(evento.target as Node)) setEmojiAberto(false);
    };
    document.addEventListener("pointerdown", foraDoSeletor);
    return () => document.removeEventListener("pointerdown", foraDoSeletor);
  }, [emojiAberto]);

  if (!visivel) return null;
  return (
    <CompositorDeMensagem
      onEnviar={aoEnviar}
      enviando={enviando}
      erro={erro}
      enviadas={enviadas}
      campoRef={campo}
      seletor={{
        aberto: emojiAberto,
        raizRef: seletor,
        botaoRef: botao,
        onAlternar: () => setEmojiAberto((aberto) => !aberto),
        onTeclar: (evento) => {
          if (evento.key !== "Escape" || !emojiAberto) return;
          evento.stopPropagation();
          setEmojiAberto(false);
          botao.current?.focus();
        },
        // Insere na posição do cursor (ou no lugar da seleção) e devolve o foco ao campo.
        onEscolher: (emoji) => {
          const area = campo.current;
          setEmojiAberto(false);
          if (!area) return;
          area.setRangeText(emoji, area.selectionStart, area.selectionEnd, "end");
          area.focus();
        },
      }}
    />
  );
}
