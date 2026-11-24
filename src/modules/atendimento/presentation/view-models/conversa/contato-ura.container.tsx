"use client";

import { PainelDeContatoUra } from "@/presentation/components/organisms/painel-de-contato-ura.component";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useContatoUra } from "@/modules/atendimento/presentation/view-models/conversa/use-contato-ura.hook";
import { useConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook";

export function ContatoUraContainer({
  atendimentoId,
  initialData,
}: {
  atendimentoId: string;
  initialData: ConversaVista;
}) {
  const { conversa } = useConversa(atendimentoId, initialData);
  const contato = useContatoUra(atendimentoId);

  return (
    <PainelDeContatoUra
      etapa={contato.etapa}
      concluido={contato.concluido}
      telefone={conversa.contatoUra.telefone}
      cnpjSugerido={conversa.contatoUra.cnpjSugerido}
      cliente={contato.cliente}
      buscando={contato.buscando}
      cadastrando={contato.cadastrando}
      aviso={contato.aviso}
      focoNoBotao={contato.focoNoBotao}
      refDoAviso={contato.refDoAviso}
      onAbrir={contato.aoAbrir}
      onBuscar={contato.aoBuscar}
      onTrocarCliente={contato.aoTrocarCliente}
      onCadastrar={contato.aoCadastrar}
      onCancelar={contato.aoCancelar}
    />
  );
}
