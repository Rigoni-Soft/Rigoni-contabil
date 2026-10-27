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
      alvoDoAviso={guias.alvoDoAviso}
      competenciaEmFalta={competenciaEmFalta(guias.guias)}
      onAnexar={() => void guias.anexar()}
      onConfirmar={(competencia) => void guias.confirmar(competencia)}
      onTrocar={(competencia, arquivo) => void guias.trocar(competencia, arquivo)}
      liberando={guias.liberando}
      onPedirLiberacao={guias.pedirLiberacao}
      onCancelarLiberacao={guias.cancelarLiberacao}
      confirmando={guias.confirmando}
      apagando={guias.apagando}
      removendo={guias.removendo}
      onPedirRemocao={guias.pedirRemocao}
      onCancelarRemocao={guias.cancelarRemocao}
      onRemover={(competencia) => void guias.remover(competencia)}
      onVisualizar={(competencia) => void guias.visualizar(competencia)}
    />
  );
}
