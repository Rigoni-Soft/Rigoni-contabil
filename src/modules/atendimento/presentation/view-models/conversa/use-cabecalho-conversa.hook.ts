import { useState } from "react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook";

// Resumo acima disso recolhe em 3 linhas; o limite da Transferência é 1000 caracteres.
const RESUMO_LONGO = 160;

export function useCabecalhoConversa(atendimentoId: string, initialData: ConversaVista) {
  const { conversa } = useConversa(atendimentoId, initialData);
  // Guarda qual resumo foi aberto: se o contexto mudar, o novo resumo volta recolhido.
  const [abertoPara, setAbertoPara] = useState<string | null>(null);
  const resumo = conversa.contexto?.resumo ?? null;

  return {
    titulo: conversa.titulo,
    subtitulo: conversa.subtitulo,
    encerrado: conversa.encerrado,
    avisoInatividade: conversa.avisoInatividade,
    contexto: conversa.contexto,
    resumoLongo: (conversa.contexto?.resumo.length ?? 0) > RESUMO_LONGO,
    resumoAberto: resumo !== null && abertoPara === resumo,
    alternarResumo: () => setAbertoPara((aberto) => (aberto === resumo ? null : resumo)),
  };
}
