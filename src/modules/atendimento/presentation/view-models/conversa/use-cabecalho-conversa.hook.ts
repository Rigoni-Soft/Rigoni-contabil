import { useState } from "react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook";

const RESUMO_LONGO = 160;

export function useCabecalhoConversa(atendimentoId: string, initialData: ConversaVista) {
  const { conversa } = useConversa(atendimentoId, initialData);
  const [abertoPara, setAbertoPara] = useState<string | null>(null);
  const resumo = conversa.contexto?.resumo ?? null;

  return {
    titulo: conversa.titulo,
    subtitulo: conversa.subtitulo,
    encerrado: conversa.encerrado,
    contexto: conversa.contexto,
    resumoLongo: (conversa.contexto?.resumo.length ?? 0) > RESUMO_LONGO,
    resumoAberto: resumo !== null && abertoPara === resumo,
    alternarResumo: () => setAbertoPara((aberto) => (aberto === resumo ? null : resumo)),
  };
}
