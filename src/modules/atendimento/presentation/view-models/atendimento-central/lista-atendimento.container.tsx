"use client";

import { ListaDeAtendimento } from "@/presentation/components/organisms/lista-de-atendimento.component";
import { PainelDeEmAtendimento } from "@/presentation/components/organisms/painel-de-em-atendimento.component";
import { PainelDeEspera } from "@/presentation/components/organisms/painel-de-espera.component";
import {
  useAtendimentoCentral,
  type EntradaDaLista,
} from "@/modules/atendimento/presentation/view-models/atendimento-central/use-atendimento-central.hook";
import { totalDePendentes } from "@/modules/atendimento/presentation/view-models/atendimento-central/pendentes.presenter";
import { useFocoNaLista } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-foco-da-tela.hook";
import { OPCOES_DE_SETOR } from "@/modules/atendimento/presentation/view-models/fila/fila.presenter";

export function ListaAtendimentoContainer(entrada: EntradaDaLista) {
  const lista = useAtendimentoCentral(entrada);
  const foco = useFocoNaLista(lista.abertoId);

  return (
    <ListaDeAtendimento
      aba={lista.aba}
      onEscolherAba={lista.escolherAba}
      contadores={{
        espera: lista.itens.length,
        atendimento: totalDePendentes(0, lista.emAtendimento),
      }}
      aviso={lista.avisoDeAssuncao}
      indisponivel={lista.indisponivel}
      escondidaNoCelular={lista.abertoId !== null}
      anuncio={lista.anuncio}
      ref={foco}
      escolhaDeSetor={
        entrada.podeEscolherSetor
          ? { setor: lista.setor, opcoes: OPCOES_DE_SETOR, onChange: lista.escolherSetor }
          : undefined
      }
    >
      {lista.aba === "espera" ? (
        <PainelDeEspera
          itens={lista.itens}
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
