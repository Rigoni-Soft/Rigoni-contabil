"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CartaoDePonto } from "@/presentation/components/organisms/cartao-de-ponto.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";

import { salvarDiaDoPontoAction } from "./folha-de-ponto.actions";
import {
  AVISO_SEM_CONVENCAO,
  itensDaTotalizacao,
  lerDiaDoFormulario,
  linhasDoCartao,
  navegacaoDoCartao,
  totaisDoCartao,
} from "./folha-de-ponto.presenter";

type Props = { folha: FolhaDePontoDto };

// O cartão do mês do empregado escolhido: cada dia é salvo à parte e a Totalização se recalcula na recarga.
export function CartaoDePontoContainer({ folha }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ data: string; tipo: "erro" | "sucesso"; texto: string }>();
  const { selecionado } = folha;
  if (!selecionado) return null;

  const salvarDia = (data: string, campos: FormData) => {
    const lido = lerDiaDoFormulario(campos);
    if (!lido.ok) return setAviso({ data, tipo: "erro", texto: lido.erro });
    iniciar(async () => {
      setAviso(undefined);
      try {
        const r = await salvarDiaDoPontoAction({
          empregadoId: selecionado.empregado.id,
          data,
          batidas: lido.batidas,
          extra: lido.extra,
          abono: lido.abono,
        });
        if (!r.ok) return setAviso({ data, tipo: "erro", texto: r.error.message });
        setAviso({ data, tipo: "sucesso", texto: "Salvo." });
        router.refresh();
      } catch (e) {
        console.error("Falha ao salvar o dia do cartão de ponto", e);
        setAviso({ data, tipo: "erro", texto: mensagemDaFalha(e) });
      }
    });
  };

  return (
    <CartaoDePonto
      empregado={selecionado.empregado.nome}
      empresa={folha.empresa}
      periodo={rotuloDaCompetencia(folha.competencia)}
      rotuloMes={rotuloDaCompetencia(folha.competencia)}
      {...navegacaoDoCartao(folha)}
      linhas={linhasDoCartao(selecionado.dias)}
      totais={totaisDoCartao(selecionado.dias, selecionado.totalizacao)}
      totalizacao={itensDaTotalizacao(
        selecionado.totalizacao,
        selecionado.dias.reduce((soma, d) => soma + d.trabalhadoMin, 0),
      )}
      avisoDaTotalizacao={selecionado.semConvencao ? AVISO_SEM_CONVENCAO : undefined}
      editavel={folha.podeEditar && selecionado.empregado.ativo}
      pendente={pendente}
      aviso={aviso}
      empregadoId={selecionado.empregado.id}
      onSalvarDia={salvarDia}
    />
  );
}
