import { useSyncExternalStore } from "react";

import { useFilaQuery } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";

// O contador do menu consulta as mesmas chaves da tela Atendimento (uma leitura só, com o polling de
// 15 s): é ele que mantém o número e o aviso sonoro vivos nas demais telas, onde antes havia o Dock.
// `pronto`: as duas leituras já responderam (certo ou negada); antes disso o zero é "ainda não sei".
export function usePendentesDoMenu() {
  // Falso no servidor e na hidratação (o servidor não tem o cache): sem isso o primeiro render do
  // cliente já traz o contador e a pílula não bate com o HTML do servidor.
  const hidratado = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const fila = useFilaQuery(null, undefined);
  const meus = useMeusAtendimentosQuery(true);
  const emAtendimento = (meus.data ?? []).map(atendimentoParaView);
  return {
    total: hidratado
      ? (fila.data?.length ?? 0) + emAtendimento.filter((c) => c.aguardando).length
      : 0,
    idsDaEspera: (fila.data ?? []).map((item) => item.atendimentoId),
    emAtendimento,
    pronto: !fila.isPending && !meus.isPending,
  };
}
