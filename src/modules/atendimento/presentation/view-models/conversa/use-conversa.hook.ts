import { useState } from "react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import {
  conversaParaView,
  documentoDaOpcao,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import {
  useConversaQuery,
  useEnviarDocumentoMutation,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";

export function useConversa(atendimentoId: string, initialData: ConversaVista) {
  const query = useConversaQuery(atendimentoId, initialData);
  const envio = useEnviarDocumentoMutation(atendimentoId);
  const [escolhido, setEscolhido] = useState("");

  const conversa = conversaParaView(query.data);
  // O primeiro documento vale até o Funcionário escolher; se o escolhido sumiu da lista, volta a ele.
  const servicoEscolhido = conversa.servicos.some((s) => s.valor === escolhido)
    ? escolhido
    : (conversa.servicos[0]?.valor ?? "");

  const aviso = envio.isError
    ? { tipo: "erro" as const, texto: envio.error.message }
    : query.isError
      ? { tipo: "erro" as const, texto: "Não foi possível atualizar a conversa." }
      : envio.isSuccess
        ? { tipo: "sucesso" as const, texto: "Documento enviado ao cliente." }
        : undefined;

  return {
    ...conversa,
    servicoEscolhido,
    aoEscolherServico: setEscolhido,
    aoEnviarServico: () => envio.mutate(documentoDaOpcao(servicoEscolhido)),
    enviando: envio.isPending,
    aviso,
  };
}
