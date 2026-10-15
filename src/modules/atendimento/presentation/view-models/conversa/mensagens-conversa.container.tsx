"use client";

import { ListaDeMensagens } from "@/presentation/components/organisms/lista-de-mensagens.component";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { PreviaDeOfficeContainer } from "@/modules/atendimento/presentation/view-models/conversa/previa-de-office.container";
import { useMensagensConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-mensagens-conversa.hook";

export function MensagensConversaContainer({
  atendimentoId,
  initialData,
}: {
  atendimentoId: string;
  initialData: ConversaVista;
}) {
  const { mensagens, anteriores, reacao, arraste } = useMensagensConversa(
    atendimentoId,
    initialData,
  );

  return (
    <ListaDeMensagens
      mensagens={mensagens}
      anteriores={anteriores}
      reacao={reacao}
      arraste={arraste}
      previaDoAnexo={(anexo) => (
        <PreviaDeOfficeContainer
          nome={anexo.nome}
          url={anexo.urlVisualizacao}
          formato={anexo.formato}
          painelId={anexo.painelId}
        />
      )}
    />
  );
}
