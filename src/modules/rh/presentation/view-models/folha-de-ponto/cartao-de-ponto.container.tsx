"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { idDoFormDoDia } from "@/presentation/components/molecules/linha-do-cartao-de-ponto.component";
import { CartaoDePonto } from "@/presentation/components/organisms/cartao-de-ponto.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";

import { salvarDiaDoPontoAction } from "./folha-de-ponto.actions";
import {
  AVISO_SEM_CONVENCAO,
  hrefDaFolha,
  itensDaTotalizacao,
  lerDiaDoFormulario,
  linhasDoCartao,
  navegacaoDoCartao,
} from "./folha-de-ponto.presenter";

type Props = { folha: FolhaDePontoDto };
type Aviso = { tipo: "erro" | "sucesso"; texto: string };

// O cartão do mês do empregado escolhido. Cada linha abre para editar (lápis), salva ou cancela; o "Salvar" da
// tabela salva todas as linhas abertas e fica na tela (a Totalização se recalcula e ganha destaque); "Limpar"
// esvazia os campos das linhas abertas; "Cancelar" (link) volta à lista de empregados.
export function CartaoDePontoContainer({ folha }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<Aviso & { data: string }>();
  const [avisoGeral, setAvisoGeral] = useState<Aviso>();
  const [emEdicao, setEmEdicao] = useState<string[]>([]);
  const [limpos, setLimpos] = useState<string[]>([]);
  const [versoes, setVersoes] = useState<Record<string, number>>({});
  const [destacada, setDestacada] = useState(false);
  const { selecionado } = folha;
  if (!selecionado) return null;

  const recomecar = (datas: string[]) =>
    setVersoes((v) => ({ ...v, ...Object.fromEntries(datas.map((d) => [d, (v[d] ?? 0) + 1])) }));
  const fechar = (datas: string[]) => {
    setEmEdicao((e) => e.filter((d) => !datas.includes(d)));
    setLimpos((l) => l.filter((d) => !datas.includes(d)));
  };

  // Grava um dia; devolve o texto do erro, ou undefined se deu certo.
  const gravar = async (data: string, campos: FormData): Promise<string | undefined> => {
    const lido = lerDiaDoFormulario(campos);
    if (!lido.ok) return lido.erro;
    try {
      const r = await salvarDiaDoPontoAction({
        empregadoId: selecionado.empregado.id,
        data,
        batidas: lido.batidas,
        extra: lido.extra,
        abono: lido.abono,
      });
      return r.ok ? undefined : r.error.message;
    } catch (e) {
      console.error("Falha ao salvar o dia do cartão de ponto", e);
      return mensagemDaFalha(e);
    }
  };

  const salvarDia = (data: string, campos: FormData) =>
    iniciar(async () => {
      setAviso(undefined);
      setAvisoGeral(undefined);
      const erro = await gravar(data, campos);
      if (erro) return setAviso({ data, tipo: "erro", texto: erro });
      setAviso({ data, tipo: "sucesso", texto: "Salvo." });
      fechar([data]);
      recomecar([data]);
      router.refresh();
    });

  const salvarTabela = () =>
    iniciar(async () => {
      setAviso(undefined);
      setAvisoGeral(undefined);
      for (const data of emEdicao) {
        const form = document.getElementById(idDoFormDoDia(data));
        if (!(form instanceof HTMLFormElement)) continue;
        const erro = await gravar(data, new FormData(form));
        if (erro) return setAviso({ data, tipo: "erro", texto: erro });
      }
      recomecar(emEdicao);
      fechar(emEdicao);
      setDestacada(true);
      setAvisoGeral({ tipo: "sucesso", texto: "Salvo. A Totalização do mês foi atualizada." });
      router.refresh();
    });

  return (
    <CartaoDePonto
      empregado={selecionado.empregado.nome}
      empresa={folha.empresa}
      periodo={rotuloDaCompetencia(folha.competencia)}
      rotuloMes={rotuloDaCompetencia(folha.competencia)}
      {...navegacaoDoCartao(folha)}
      linhas={linhasDoCartao(selecionado.dias)}
      totalizacao={itensDaTotalizacao(
        selecionado.totalizacao,
        selecionado.dias.reduce((soma, d) => soma + d.trabalhadoMin, 0),
      )}
      avisoDaTotalizacao={selecionado.semConvencao ? AVISO_SEM_CONVENCAO : undefined}
      editavel={folha.podeEditar && selecionado.empregado.ativo}
      pendente={pendente}
      aviso={aviso}
      avisoGeral={avisoGeral}
      empregadoId={selecionado.empregado.id}
      diasEmEdicao={emEdicao}
      diasLimpos={limpos}
      versoes={versoes}
      listaHref={hrefDaFolha(folha.clienteId, { mes: folha.competencia })}
      totalizacaoDestacada={destacada}
      onEditarDia={(data) => {
        setDestacada(false);
        setAvisoGeral(undefined);
        setEmEdicao((e) => (e.includes(data) ? e : [...e, data]));
      }}
      onCancelarDia={(data) => {
        setAviso(undefined);
        fechar([data]);
        recomecar([data]);
      }}
      onSalvarDia={salvarDia}
      onSalvarTabela={salvarTabela}
      onLimparTabela={() => {
        setDestacada(false);
        setAvisoGeral(undefined);
        setLimpos(emEdicao);
        recomecar(emEdicao);
      }}
    />
  );
}
