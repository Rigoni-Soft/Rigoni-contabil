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
  const cabecalho = useCabecalhoConversa(atendimentoId, initialData);

  return (
    <CabecalhoDaConversa
      titulo={cabecalho.titulo}
      subtitulo={cabecalho.subtitulo}
      encerrado={cabecalho.encerrado}
      contexto={cabecalho.contexto}
      resumoLongo={cabecalho.resumoLongo}
      resumoAberto={cabecalho.resumoAberto}
      onAlternarResumo={cabecalho.alternarResumo}
    />
  );
}
