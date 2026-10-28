"use client";

import { ListaDeAtendimento } from "@/presentation/components/organisms/lista-de-atendimento.component";
import { PainelDeEmAtendimento } from "@/presentation/components/organisms/painel-de-em-atendimento.component";
import { PainelDeEspera } from "@/presentation/components/organisms/painel-de-espera.component";
import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import type { AtendimentoVisto } from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";
import { useAtendimentoCentral } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-atendimento-central.hook";
import { useFocoNaLista } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-foco-da-tela.hook";
import { SETOR_LABEL, SETORES, type SetorSlug } from "@/shared/kernel/setores";

type ListaAtendimentoContainerProps = {
  usuarioId: string;
  setorInicial: SetorSlug;
  filaInicial: ItemDaFilaVisto[];
  meusInicial: AtendimentoVisto[];
  podeEscolherSetor: boolean;
};

const OPCOES = SETORES.map((valor) => ({ valor, rotulo: SETOR_LABEL[valor] }));

export function ListaAtendimentoContainer(entrada: ListaAtendimentoContainerProps) {
  const lista = useAtendimentoCentral(entrada);
  const foco = useFocoNaLista(lista.abertoId);

  return (
    <ListaDeAtendimento
      aba={lista.aba}
      onEscolherAba={lista.escolherAba}
      contadores={{ espera: lista.espera.length, atendimento: lista.emAtendimento.length }}
      aviso={lista.avisoDeAssuncao}
      indisponivel={lista.indisponivel}
      escondidaNoCelular={lista.abertoId !== null}
      anuncio={lista.anuncio}
      ref={foco}
      escolhaDeSetor={
        entrada.podeEscolherSetor
          ? { setor: lista.setor, opcoes: OPCOES, onChange: lista.escolherSetor }
          : undefined
      }
    >
      {lista.aba === "espera" ? (
        <PainelDeEspera
          itens={lista.espera}
          carregando={lista.carregando}
          assumindo={lista.assumindo}
          onAssumir={lista.assumir}
        />
      ) : (
        <PainelDeEmAtendimento
          itens={lista.emAtendimento}
          abertoId={lista.abertoId}
          onAbrir={lista.abrir}
        />
      )}
    </ListaDeAtendimento>
  );
}
