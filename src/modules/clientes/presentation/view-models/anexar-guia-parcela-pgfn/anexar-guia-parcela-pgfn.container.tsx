"use client";

import { GuiasDaParcelaPgfn } from "@/presentation/components/organisms/guias-da-parcela-pgfn.component";

import {
  competenciaEmFalta,
  idDaRegiao,
  linhasDeGuias,
} from "./anexar-guia-parcela-pgfn.presenter";
import { useGuiasDaParcela } from "./use-guias-da-parcela.hook";

type Props = { parcelamentoId: string; codigo: string; interno: boolean };

export function AnexarGuiaParcelaPgfnContainer({ parcelamentoId, codigo, interno }: Props) {
  const prefixo = `guias-${parcelamentoId}`;
  const guias = useGuiasDaParcela(parcelamentoId, prefixo);

  return (
    <GuiasDaParcelaPgfn
      id={prefixo}
      codigo={codigo}
      interno={interno}
      idDaRegiao={idDaRegiao(prefixo)}
      guias={linhasDeGuias(guias.guias, prefixo)}
      carregando={guias.carregando}
      erroDaLista={guias.erroDaLista}
      onTentarNovamente={guias.recarregar}
      anexo={guias.anexo}
      pendente={guias.pendente}
      anexando={guias.anexando}
      erroServidor={guias.erroServidor}
      resultado={guias.resultado}
      competenciaEmFalta={competenciaEmFalta(guias.guias)}
      acao={guias.acao}
      acoes={guias.acoes}
    />
  );
}
