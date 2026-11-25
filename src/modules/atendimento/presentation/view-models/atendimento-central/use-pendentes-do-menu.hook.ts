import { useSyncExternalStore } from "react";

import { useFilaQuery } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";

const nuncaNotifica = () => () => undefined;

export function usePendentesDoMenu() {
  const hidratado = useSyncExternalStore(
    nuncaNotifica,
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
