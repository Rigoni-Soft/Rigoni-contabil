import { useMemo } from "react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { conversaParaView } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import {
  useConversaQuery,
  useTransferenciaConcluida,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";

export function useConversa(atendimentoId: string, initialData: ConversaVista) {
  const transferencia = useTransferenciaConcluida(atendimentoId);
  const query = useConversaQuery(atendimentoId, initialData, !transferencia);
  const conversa = useMemo(() => conversaParaView(query.data), [query.data]);

  return {
    conversa,
    transferidoPara: transferencia
      ? conversa.setoresDestino.find((s) => s.valor === transferencia.setorDestino)?.rotulo
      : undefined,
    transferido: transferencia !== undefined,
    erroDeLeitura: query.isError && !transferencia,
  };
}
