import { useFilaQuery } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { totalDePendentes } from "@/modules/atendimento/presentation/view-models/atendimento-central/pendentes.presenter";
import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";

// O contador do menu lê as mesmas chaves do aviso global e da tela Atendimento: não abre leitura nova.
export function usePendentesDoMenu() {
  const fila = useFilaQuery(null, undefined);
  const meus = useMeusAtendimentosQuery(true);
  return totalDePendentes(fila.data?.length ?? 0, (meus.data ?? []).map(atendimentoParaView));
}
