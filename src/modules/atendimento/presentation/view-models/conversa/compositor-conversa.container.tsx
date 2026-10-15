"use client";

import { CompositorDeMensagem } from "@/presentation/components/organisms/compositor-de-mensagem.component";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useCompositor } from "@/modules/atendimento/presentation/view-models/conversa/use-compositor.hook";
import { useGravacaoNoCompositor } from "@/modules/atendimento/presentation/view-models/conversa/use-gravacao-no-compositor.hook";
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
    aoEnviarAudio,
    aoCancelarAudio,
    arraste,
  } = useCompositor(atendimentoId, initialData);

  const { campoRef, seletor } = useSeletorDeEmoji();
  const { erro: erroDaGravacao, gravacao } = useGravacaoNoCompositor({
    aoEnviarAudio,
    aoCancelarAudio,
  });

  if (!visivel) return null;
  return (
    <CompositorDeMensagem
      onEnviar={aoEnviar}
      enviando={enviando}
      erro={erroDaGravacao ?? erro}
      enviadas={enviadas}
      campoRef={campoRef}
      seletor={seletor}
      anexo={anexo}
      aceitar={aceitar}
      onAnexar={aoAnexar}
      onRemoverAnexo={aoRemoverAnexo}
      gravacao={gravacao}
      arraste={arraste}
    />
  );
}
