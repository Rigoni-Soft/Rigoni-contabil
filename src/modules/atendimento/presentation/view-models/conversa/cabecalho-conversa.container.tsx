"use client";

import { CabecalhoDaConversa } from "@/presentation/components/organisms/cabecalho-da-conversa.component";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useCabecalhoConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-cabecalho-conversa.hook";

export function CabecalhoConversaContainer({
  atendimentoId,
  initialData,
}: {
  atendimentoId: string;
  initialData: ConversaVista;
}) {
  const { titulo, subtitulo, encerrado, contexto } = useCabecalhoConversa(
    atendimentoId,
    initialData,
  );

  return (
    <CabecalhoDaConversa
      titulo={titulo}
      subtitulo={subtitulo}
      encerrado={encerrado}
      contexto={contexto}
    />
  );
}
