import { useFilaQuery } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { totalDePendentes } from "@/modules/atendimento/presentation/view-models/atendimento-central/pendentes.presenter";
import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";

// O contador do menu lê as mesmas chaves do aviso global e da tela Atendimento: não abre leitura nova.
// `pronto`: as duas leituras já responderam (certo ou negada); antes disso o zero é "ainda não sei".
export function usePendentesDoMenu() {
  const fila = useFilaQuery(null, undefined);
  const meus = useMeusAtendimentosQuery(true);
  return {
    total: totalDePendentes(fila.data?.length ?? 0, (meus.data ?? []).map(atendimentoParaView)),
    pronto: !fila.isPending && !meus.isPending,
  };
}
