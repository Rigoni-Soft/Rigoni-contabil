"use client";

import { PainelDeAcoes } from "@/presentation/components/organisms/painel-de-acoes.component";
import { PainelDeEncerramento } from "@/presentation/components/organisms/painel-de-encerramento.component";
import { PainelDeServicos } from "@/presentation/components/organisms/painel-de-servicos.component";
import { PainelDeTransferencia } from "@/presentation/components/organisms/painel-de-transferencia.component";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useAcoesConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-acoes-conversa.hook";

export function AcoesConversaContainer({
  atendimentoId,
  initialData,
  aoSair,
}: {
  atendimentoId: string;
  initialData: ConversaVista;
  aoSair?: () => void;
}) {
  const acoes = useAcoesConversa(atendimentoId, initialData, aoSair);

  if (!acoes.visivel) return null;
  return (
    <PainelDeAcoes
      transferidoPara={acoes.transferidoPara}
      servicos={
        !acoes.somenteLeitura && (
          <PainelDeServicos
            semCliente={acoes.semCliente}
            servicos={acoes.servicos}
            onEnviarServico={acoes.aoEnviarServico}
            enviando={acoes.enviando}
            aviso={acoes.aviso}
          />
        )
      }
      transferencia={
        !acoes.somenteLeitura && (
          <PainelDeTransferencia
            setoresDestino={acoes.setoresDestino}
            onTransferir={acoes.aoTransferir}
            transferindo={acoes.transferindo}
            aviso={acoes.avisoTransferencia}
          />
        )
      }
      encerramento={
        <PainelDeEncerramento
          confirmando={acoes.confirmandoEncerramento}
          encerrando={acoes.encerrando}
          onPedir={acoes.aoPedirEncerramento}
          onCancelar={acoes.aoCancelarEncerramento}
          onConfirmar={acoes.aoConfirmarEncerramento}
          aviso={acoes.avisoEncerramento}
        />
      }
    />
  );
}
