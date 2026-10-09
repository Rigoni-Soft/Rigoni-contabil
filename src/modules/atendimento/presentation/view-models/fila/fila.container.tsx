"use client";

import { FilaDoSetor } from "@/presentation/components/organisms/fila-do-setor.component";
import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { useFila } from "@/modules/atendimento/presentation/view-models/fila/use-fila.hook";
import { SETOR_LABEL, SETORES } from "@/shared/kernel/setores";

type FilaContainerProps = {
  setorInicial: string;
  initialData: ItemDaFilaVisto[];
  podeEscolherSetor: boolean;
};

const OPCOES = SETORES.map((valor) => ({ valor, rotulo: SETOR_LABEL[valor] }));

export function FilaContainer({
  setorInicial,
  initialData,
  podeEscolherSetor,
}: FilaContainerProps) {
  const { setor, escolherSetor, itens, indisponivel } = useFila(setorInicial, initialData);

  return (
    <FilaDoSetor
      itens={itens}
      indisponivel={indisponivel}
      escolhaDeSetor={
        podeEscolherSetor ? { setor, opcoes: OPCOES, onChange: escolherSetor } : undefined
      }
    />
  );
}
