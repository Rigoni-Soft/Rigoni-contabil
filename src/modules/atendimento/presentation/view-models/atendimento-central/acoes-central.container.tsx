"use client";

import { useAtendimentoCentralStore } from "@/modules/atendimento/presentation/view-models/atendimento-central/atendimento-central.store";
import { useConversaAberta } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-conversa-aberta.hook";
import { AcoesConversaContainer } from "@/modules/atendimento/presentation/view-models/conversa/acoes-conversa.container";

export function AcoesCentralContainer() {
  const { abertoId, fecharConversa } = useAtendimentoCentralStore();
  const aberta = useConversaAberta(abertoId);

  if (abertoId === null || !aberta.data || aberta.data.encerrado) return null;
  return (
    <AcoesConversaContainer
      key={abertoId}
      atendimentoId={abertoId}
      initialData={aberta.data}
      aoSair={fecharConversa}
    />
  );
}
