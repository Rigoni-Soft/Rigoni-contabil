"use client";

import { Fragment } from "react";

import { PainelDoChat } from "@/presentation/components/organisms/painel-do-chat.component";
import { useAtendimentoCentralStore } from "@/modules/atendimento/presentation/view-models/atendimento-central/atendimento-central.store";
import { useConversaAberta } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-conversa-aberta.hook";
import { useFocoNoChat } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-foco-da-tela.hook";
import { CabecalhoConversaContainer } from "@/modules/atendimento/presentation/view-models/conversa/cabecalho-conversa.container";
import { CompositorConversaContainer } from "@/modules/atendimento/presentation/view-models/conversa/compositor-conversa.container";
import { MensagensConversaContainer } from "@/modules/atendimento/presentation/view-models/conversa/mensagens-conversa.container";

// O chat da conversa aberta, no centro. Reaproveita as regiões do Painel do Funcionário; a
// conversa em si vem da mesma leitura que as ações usam (uma consulta só).
export function ChatCentralContainer() {
  const { abertoId, fecharConversa } = useAtendimentoCentralStore();
  const aberta = useConversaAberta(abertoId);
  const foco = useFocoNoChat(abertoId, aberta.data !== undefined);
  const estado =
    abertoId === null ? "vazio" : aberta.data ? "pronto" : aberta.isError ? "erro" : "abrindo";

  return (
    <PainelDoChat
      estado={estado}
      onVoltar={fecharConversa}
      ref={foco}
      comAcoes={aberta.data?.encerrado === false}
    >
      {abertoId !== null && aberta.data && (
        // `key`: trocar de conversa recomeça o estado local (rascunho, emoji, gravação).
        <Fragment key={abertoId}>
          <CabecalhoConversaContainer atendimentoId={abertoId} initialData={aberta.data} />
          <MensagensConversaContainer atendimentoId={abertoId} initialData={aberta.data} />
          <CompositorConversaContainer atendimentoId={abertoId} initialData={aberta.data} />
        </Fragment>
      )}
    </PainelDoChat>
  );
}
