import { useEffect } from "react";

import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import type { AtendimentoVisto } from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";
import { useAtendimentoCentralStore } from "@/modules/atendimento/presentation/view-models/atendimento-central/atendimento-central.store";
import { useAnuncioDaLista } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-anuncio-da-lista.hook";
import { useAssumirAtendimentoMutation } from "@/modules/atendimento/presentation/view-models/fila/assumir.queries";
import { useSomDaLista } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-som-da-lista.hook";
import { useFila } from "@/modules/atendimento/presentation/view-models/fila/use-fila.hook";
import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";
import type { SetorSlug } from "@/shared/kernel/setores";

const AVISO_DE_ASSUNCAO_MS = 8_000;

export type EntradaDaLista = {
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
}: EntradaDaLista) {
  const fila = useFila(setorInicial, filaInicial, podeEscolherSetor, usuarioId);
  const meus = useMeusAtendimentosQuery(true, meusInicial);
  const assumir = useAssumirAtendimentoMutation();
  const { aba, abertoId, escolherAba, abrir, aoAssumir } = useAtendimentoCentralStore();
  const { isError, reset } = assumir;
  const emAtendimento = (meus.data ?? []).map(atendimentoParaView);
  const anuncio = useAnuncioDaLista(fila.itens, emAtendimento, abertoId);
  useSomDaLista(fila.itens.map((item) => item.id), emAtendimento, abertoId);

  // "Já assumido" informa uma tentativa, não um estado da tela: some sozinho, e ao trocar de aba.
  useEffect(() => {
    if (!isError) return;
    const timer = setTimeout(reset, AVISO_DE_ASSUNCAO_MS);
    return () => clearTimeout(timer);
  }, [isError, reset]);

  return {
    ...fila,
    aba,
    escolherAba: (nova: typeof aba) => {
      reset();
      escolherAba(nova);
    },
    anuncio,
    emAtendimento,
    abertoId,
    abrir,
    assumir: (atendimentoId: string) =>
      assumir.mutate(atendimentoId, { onSuccess: () => aoAssumir(atendimentoId) }),
    assumindo: assumir.isPending,
    avisoDeAssuncao: assumir.error?.message,
  };
}
