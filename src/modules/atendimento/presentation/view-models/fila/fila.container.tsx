"use client";

import { FilaDoSetor } from "@/presentation/components/organisms/fila-do-setor.component";
import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { tituloDaFila } from "@/modules/atendimento/presentation/view-models/fila/fila.presenter";
import { useFila } from "@/modules/atendimento/presentation/view-models/fila/use-fila.hook";
import { SETOR_LABEL, SETORES } from "@/shared/kernel/setores";

type FilaContainerProps = {
  nome: string;
  nivelDoTitulo?: 1 | 2;
  setorInicial: string;
  initialData: ItemDaFilaVisto[];
  podeEscolherSetor: boolean;
};

const OPCOES = SETORES.map((valor) => ({ valor, rotulo: SETOR_LABEL[valor] }));

export function FilaContainer({
  nome,
  nivelDoTitulo,
  setorInicial,
  initialData,
  podeEscolherSetor,
}: FilaContainerProps) {
  const { setor, escolherSetor, itens, carregando, indisponivel } = useFila(
    setorInicial,
    initialData,
    podeEscolherSetor,
  );

  return (
    <FilaDoSetor
      titulo={tituloDaFila(nome, setor)}
      nivelDoTitulo={nivelDoTitulo}
      itens={itens}
      carregando={carregando}
      indisponivel={indisponivel}
      escolhaDeSetor={
        podeEscolherSetor ? { setor, opcoes: OPCOES, onChange: escolherSetor } : undefined
      }
    />
  );
}
