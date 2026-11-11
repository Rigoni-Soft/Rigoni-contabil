"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CartaoDePonto } from "@/presentation/components/organisms/cartao-de-ponto.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";

import { salvarDiaDoPontoAction } from "./folha-de-ponto.actions";
import {
  itensDaTotalizacao,
  lerDiaDoFormulario,
  linhasDoCartao,
  navegacaoDoCartao,
} from "./folha-de-ponto.presenter";

type Props = { folha: FolhaDePontoDto };

// O cartão da quinzena do empregado escolhido: cada dia é salvo à parte e a Totalização se recalcula na recarga.
export function CartaoDePontoContainer({ folha }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string>();
  const { selecionado } = folha;
  if (!selecionado) return null;

  const salvarDia = (data: string, campos: FormData) => {
    const lido = lerDiaDoFormulario(campos);
    if (!lido.ok) return setErro(lido.erro);
    iniciar(async () => {
      setErro(undefined);
      try {
        const r = await salvarDiaDoPontoAction({
          empregadoId: selecionado.empregado.id,
          data,
          batidas: lido.batidas,
          extra: lido.extra,
          abono: lido.abono,
        });
        if (!r.ok) return setErro(r.error.message);
        router.refresh();
      } catch (e) {
        console.error("Falha ao salvar o dia do cartão de ponto", e);
        setErro(mensagemDaFalha(e));
      }
    });
  };

  return (
    <CartaoDePonto
      empregado={selecionado.empregado.nome}
      rotuloMes={rotuloDaCompetencia(folha.competencia)}
      {...navegacaoDoCartao(folha)}
      linhas={linhasDoCartao(selecionado.dias)}
      totalizacao={itensDaTotalizacao(selecionado.totalizacao)}
      editavel={folha.podeEditar && selecionado.empregado.ativo}
      pendente={pendente}
      erro={erro}
      onSalvarDia={salvarDia}
    />
  );
}
