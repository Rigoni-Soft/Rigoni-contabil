import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { conversaParaView } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import {
  useConversaQuery,
  useTransferenciaConcluida,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";

// A leitura da conversa que as regiões da tela compartilham (mesma chave no React Query: uma
// consulta só, mesmo com vários Containers).
export function useConversa(atendimentoId: string, initialData: ConversaVista) {
  const transferencia = useTransferenciaConcluida(atendimentoId);
  // Depois de transferida a conversa não é mais do usuário: para de atualizar.
  const query = useConversaQuery(atendimentoId, initialData, !transferencia);
  const conversa = conversaParaView(query.data);

  return {
    conversa,
    transferidoPara: transferencia
      ? conversa.setoresDestino.find((s) => s.valor === transferencia.setorDestino)?.rotulo
      : undefined,
    transferido: transferencia !== undefined,
    erroDeLeitura: query.isError && !transferencia,
  };
}
