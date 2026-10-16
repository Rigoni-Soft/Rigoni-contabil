"use client";

import { AtendimentosEmAndamento } from "@/presentation/components/organisms/atendimentos-em-andamento.component";
import { useAvisoFila } from "@/modules/atendimento/presentation/view-models/fila/use-aviso-fila.hook";
import { useMeusAtendimentos } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/use-meus-atendimentos.hook";

export function MeusAtendimentosContainer() {
  const { atendimentos } = useMeusAtendimentos();
  const { aviso } = useAvisoFila();

  return <AtendimentosEmAndamento atendimentos={atendimentos} fila={aviso} />;
}
