"use client";

import { useRouter } from "next/navigation";

import { FilaDoSetor } from "@/presentation/components/organisms/fila-do-setor.component";
import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { useAssumirAtendimentoMutation } from "@/modules/atendimento/presentation/view-models/fila/assumir.queries";
import {
  OPCOES_DE_SETOR,
  tituloDaFila,
} from "@/modules/atendimento/presentation/view-models/fila/fila.presenter";
import { useFila } from "@/modules/atendimento/presentation/view-models/fila/use-fila.hook";
import type { SetorSlug } from "@/shared/kernel/setores";

type FilaContainerProps = {
  nome: string;
  nivelDoTitulo?: 1 | 2;
  setorInicial: SetorSlug;
  initialData: ItemDaFilaVisto[];
  podeEscolherSetor: boolean;
};

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

  const router = useRouter();
  const assumir = useAssumirAtendimentoMutation();

  return (
    <FilaDoSetor
      titulo={tituloDaFila(nome, setor)}
      nivelDoTitulo={nivelDoTitulo}
      itens={itens}
      carregando={carregando}
      indisponivel={indisponivel}
      onAssumir={(id) => assumir.mutate(id, { onSuccess: () => router.push(`/atendimento/${id}`) })}
      assumindoId={assumir.isPending ? assumir.variables : null}
      erroAoAssumir={assumir.error?.message ?? null}
      escolhaDeSetor={
        podeEscolherSetor ? { setor, opcoes: OPCOES_DE_SETOR, onChange: escolherSetor } : undefined
      }
    />
  );
}
