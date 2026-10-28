import { useState } from "react";

import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import type { AtendimentoVisto } from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";
import { useAssumirAtendimentoMutation } from "@/modules/atendimento/presentation/view-models/fila/assumir.queries";
import { useFila } from "@/modules/atendimento/presentation/view-models/fila/use-fila.hook";
import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";
import type { SetorSlug } from "@/shared/kernel/setores";

export type AbaDoAtendimento = "espera" | "atendimento";

type Entrada = {
  usuarioId: string;
  setorInicial: SetorSlug;
  filaInicial: ItemDaFilaVisto[];
  meusInicial: AtendimentoVisto[];
  podeEscolherSetor: boolean;
};

// Estado da tela Atendimento: a espera do Setor, os Atendimentos do usuário e qual conversa está
// aberta no centro (sem rota própria: o id vive aqui, não na URL).
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
  const [aba, setAba] = useState<AbaDoAtendimento>("espera");
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const emAtendimento = (meus.data ?? []).map(atendimentoParaView);

  return {
    ...fila,
    aba,
    escolherAba: setAba,
    espera: fila.itens,
    emAtendimento,
    abertoId,
    abrir: setAbertoId,
    fecharConversa: () => setAbertoId(null),
    // Assumiu: o Atendimento é do usuário, então a tela já o mostra aberto em "Em atendimento".
    assumir: (atendimentoId: string) =>
      assumir.mutate(atendimentoId, {
        onSuccess: () => {
          setAba("atendimento");
          setAbertoId(atendimentoId);
        },
      }),
    assumindo: assumir.isPending,
    avisoDeAssuncao: assumir.isError ? assumir.error.message : undefined,
  };
}
