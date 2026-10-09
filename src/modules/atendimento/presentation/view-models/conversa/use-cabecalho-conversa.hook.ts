import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook";

export function useCabecalhoConversa(atendimentoId: string, initialData: ConversaVista) {
  const { conversa } = useConversa(atendimentoId, initialData);

  return {
    titulo: conversa.titulo,
    subtitulo: conversa.subtitulo,
    encerrado: conversa.encerrado,
    transferencia: conversa.transferencia,
  };
}
