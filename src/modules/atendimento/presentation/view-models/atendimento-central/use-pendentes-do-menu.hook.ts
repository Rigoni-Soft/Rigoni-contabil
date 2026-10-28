import { contarAguardando } from "@/modules/atendimento/presentation/view-models/atendimento-central/pendentes.presenter";
import { useFilaQuery } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";

// O contador do menu só lê o cache das mesmas chaves do aviso global e da tela Atendimento: quem
// consulta e repete a leitura são eles. Observador desabilitado não busca nem tem polling próprio.
// `pronto`: as duas leituras já responderam (certo ou negada); antes disso o zero é "ainda não sei".
export function usePendentesDoMenu() {
  const fila = useFilaQuery(null, undefined, false);
  const meus = useMeusAtendimentosQuery(false);
  return {
    total: (fila.data?.length ?? 0) + contarAguardando((meus.data ?? []).map(atendimentoParaView)),
    pronto: !fila.isPending && !meus.isPending,
  };
}
