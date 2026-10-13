"use client";

import { CompositorDeMensagem } from "@/presentation/components/organisms/compositor-de-mensagem.component";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useCompositor } from "@/modules/atendimento/presentation/view-models/conversa/use-compositor.hook";
import { useSeletorDeEmoji } from "@/modules/atendimento/presentation/view-models/conversa/use-seletor-de-emoji.hook";

export function CompositorConversaContainer({
  atendimentoId,
  initialData,
}: {
  atendimentoId: string;
  initialData: ConversaVista;
}) {
  const {
    visivel,
    aoEnviar,
    enviando,
    erro,
    enviadas,
    anexo,
    aceitar,
    aoAnexar,
    aoRemoverAnexo,
    arraste,
  } = useCompositor(atendimentoId, initialData);

  const { campoRef, seletor } = useSeletorDeEmoji();

  if (!visivel) return null;
  return (
    <CompositorDeMensagem
      onEnviar={aoEnviar}
      enviando={enviando}
      erro={erro}
      enviadas={enviadas}
      campoRef={campoRef}
      seletor={seletor}
      anexo={anexo}
      aceitar={aceitar}
      onAnexar={aoAnexar}
      onRemoverAnexo={aoRemoverAnexo}
      arraste={arraste}
    />
  );
}
