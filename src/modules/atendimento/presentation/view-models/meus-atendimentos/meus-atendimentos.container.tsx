"use client";

import { AtendimentosEmAndamento } from "@/presentation/components/organisms/atendimentos-em-andamento.component";
import { useMeusAtendimentos } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/use-meus-atendimentos.hook";

export function MeusAtendimentosContainer() {
  const { atendimentos } = useMeusAtendimentos();

  return <AtendimentosEmAndamento atendimentos={atendimentos} />;
}
