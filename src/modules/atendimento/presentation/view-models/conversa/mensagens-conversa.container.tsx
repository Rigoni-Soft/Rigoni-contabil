"use client";

import { ListaDeMensagens } from "@/presentation/components/organisms/lista-de-mensagens.component";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useMensagensConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-mensagens-conversa.hook";

export function MensagensConversaContainer({
  atendimentoId,
  initialData,
}: {
  atendimentoId: string;
  initialData: ConversaVista;
}) {
  const { mensagens, reacao, arraste } = useMensagensConversa(atendimentoId, initialData);

  return <ListaDeMensagens mensagens={mensagens} reacao={reacao} arraste={arraste} />;
}
