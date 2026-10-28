import { useSyncExternalStore } from "react";

import { useFilaQuery } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";

// O contador do menu só lê o cache das mesmas chaves do aviso global e da tela Atendimento: quem
// consulta e repete a leitura são eles. Observador desabilitado não busca nem tem polling próprio.
// `pronto`: as duas leituras já responderam (certo ou negada); antes disso o zero é "ainda não sei".
export function usePendentesDoMenu() {
  // Falso no servidor e na hidratação (o servidor não tem o cache): sem isso o primeiro render do
  // cliente já traz o contador e a pílula não bate com o HTML do servidor.
  const hidratado = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const fila = useFilaQuery(null, undefined, false);
  const meus = useMeusAtendimentosQuery(false);
  return {
    total: hidratado
      ? (fila.data?.length ?? 0) +
        (meus.data ?? []).map(atendimentoParaView).filter((c) => c.aguardando).length
      : 0,
    pronto: !fila.isPending && !meus.isPending,
  };
}
