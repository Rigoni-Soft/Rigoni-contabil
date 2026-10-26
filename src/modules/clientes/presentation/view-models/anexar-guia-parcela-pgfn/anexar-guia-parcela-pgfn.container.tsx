"use client";

import { GuiasDaParcelaPgfn } from "@/presentation/components/organisms/guias-da-parcela-pgfn.component";

import { linhasDeGuias } from "./anexar-guia-parcela-pgfn.presenter";
import { useGuiasDaParcela } from "./use-guias-da-parcela.hook";

type Props = { parcelamentoId: string };

export function AnexarGuiaParcelaPgfnContainer({ parcelamentoId }: Props) {
  const prefixo = `guias-${parcelamentoId}`;
  const guias = useGuiasDaParcela(parcelamentoId, prefixo);

  return (
    <GuiasDaParcelaPgfn
      id={prefixo}
      guias={linhasDeGuias(guias.guias, prefixo)}
      carregando={guias.carregando}
      erroDaLista={guias.erroDaLista}
      onTentarNovamente={guias.recarregar}
      competencia={guias.mes}
      onCompetencia={guias.setMes}
      contaNegociacao={guias.contaNegociacao}
      onContaNegociacao={guias.setContaNegociacao}
      arquivo={guias.arquivo}
      onArquivo={guias.setArquivo}
      erros={guias.erros}
      pendente={guias.pendente}
      anexando={guias.anexando}
      erroServidor={guias.erroServidor}
      resultado={guias.resultado}
      onAnexar={() => void guias.anexar()}
      onConfirmar={(competencia) => void guias.confirmar(competencia)}
    />
  );
}
