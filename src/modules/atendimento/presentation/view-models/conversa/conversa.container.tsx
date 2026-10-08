"use client";

import { ConversaAtendimento } from "@/presentation/components/organisms/conversa-atendimento.component";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook";

export function ConversaContainer({
  atendimentoId,
  initialData,
}: {
  atendimentoId: string;
  initialData: ConversaVista;
}) {
  const {
    titulo,
    subtitulo,
    encerrado,
    semCliente,
    mensagens,
    servicos,
    servicoEscolhido,
    aoEscolherServico,
    aoEnviarServico,
    enviando,
    aviso,
  } = useConversa(atendimentoId, initialData);

  return (
    <ConversaAtendimento
      titulo={titulo}
      subtitulo={subtitulo}
      encerrado={encerrado}
      semCliente={semCliente}
      mensagens={mensagens}
      servicos={servicos}
      servicoEscolhido={servicoEscolhido}
      onEscolherServico={aoEscolherServico}
      onEnviarServico={aoEnviarServico}
      enviando={enviando}
      aviso={aviso}
    />
  );
}
