import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import type { AtendimentoVisto } from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";
import { useAtendimentoCentralStore } from "@/modules/atendimento/presentation/view-models/atendimento-central/atendimento-central.store";
import { useAssumirAtendimentoMutation } from "@/modules/atendimento/presentation/view-models/fila/assumir.queries";
import { useFila } from "@/modules/atendimento/presentation/view-models/fila/use-fila.hook";
import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";
import type { SetorSlug } from "@/shared/kernel/setores";

type Entrada = {
  usuarioId: string;
  setorInicial: SetorSlug;
  filaInicial: ItemDaFilaVisto[];
  meusInicial: AtendimentoVisto[];
  podeEscolherSetor: boolean;
};

// A região da lista: a espera do Setor, os Atendimentos do usuário e o assumir. Aba e conversa
// aberta ficam no store da tela, porque o chat e as ações também dependem delas.
export function useAtendimentoCentral({
  usuarioId,
  setorInicial,
  filaInicial,
  meusInicial,
  podeEscolherSetor,
}: Entrada) {
  const fila = useFila(setorInicial, filaInicial, podeEscolherSetor, usuarioId);
  const meus = useMeusAtendimentosQuery(true, meusInicial);
  const assumir = useAssumirAtendimentoMutation();
  const { aba, abertoId, escolherAba, abrir, aoAssumir } = useAtendimentoCentralStore();

  return {
    ...fila,
    aba,
    escolherAba,
    espera: fila.itens,
    emAtendimento: (meus.data ?? []).map(atendimentoParaView),
    abertoId,
    abrir,
    assumir: (atendimentoId: string) =>
      assumir.mutate(atendimentoId, { onSuccess: () => aoAssumir(atendimentoId) }),
    assumindo: assumir.isPending,
    avisoDeAssuncao: assumir.isError ? assumir.error.message : undefined,
  };
}
