"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { idDoFormDoDia } from "@/presentation/components/molecules/linha-do-cartao-de-ponto.component";
import { CartaoDePonto } from "@/presentation/components/organisms/cartao-de-ponto.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";

import { iniciarCartaoDoPontoAction, salvarDiaDoPontoAction } from "./folha-de-ponto.actions";
import {
  AVISO_SEM_CONVENCAO,
  cartaoSemDados,
  hrefDaFolha,
  itensDaTotalizacao,
  lerDiaDoFormulario,
  linhasDoCartao,
  navegacaoDoCartao,
  temDados,
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
  // Cartão sem nenhum dado (mês ou empregado novo): abre com todas as linhas já editáveis, sem um lápis por dia.
  const [emEdicao, setEmEdicao] = useState<string[]>(() =>
    folha.selecionado && cartaoSemDados(folha.selecionado.dias, folha.selecionado.iniciado)
      ? folha.selecionado.dias.map((d) => d.data)
      : [],
  );
  const [limpos, setLimpos] = useState<string[]>([]);
  const [versoes, setVersoes] = useState<Record<string, number>>({});
  const [destacada, setDestacada] = useState(false);
  // A linha da última ação: ela recebe o foco quando o botão clicado some (teclado e leitor de tela não se perdem).
  const [focoNoDia, setFocoNoDia] = useState<string>();
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
      setFocoNoDia(data);
      router.refresh();
    });

  // Falta vira abonada (o dia é gravado só com o Abono) e o abono se desfaz (dia vazio, sem Abono).
  const marcarAbono = (data: string, abono: boolean) =>
    iniciar(async () => {
      setAviso(undefined);
      setAvisoGeral(undefined);
      try {
        const r = await salvarDiaDoPontoAction({
          empregadoId: selecionado.empregado.id,
          data,
          batidas: [],
          extra: null,
          abono,
        });
        if (!r.ok) return setAviso({ data, tipo: "erro", texto: r.error.message });
        setAviso({ data, tipo: "sucesso", texto: abono ? "Abonado." : "Abono desfeito." });
        recomecar([data]);
        setFocoNoDia(data);
        router.refresh();
      } catch (e) {
        console.error("Falha ao abonar o dia do cartão de ponto", e);
        setAviso({ data, tipo: "erro", texto: mensagemDaFalha(e) });
      }
    });

  // Marca o cartão do mês como iniciado; devolve o texto do erro, ou undefined se deu certo.
  const marcarIniciado = async (): Promise<string | undefined> => {
    try {
      const r = await iniciarCartaoDoPontoAction({
        empregadoId: selecionado.empregado.id,
        competencia: folha.competencia,
      });
      return r.ok ? undefined : r.error.message;
    } catch (e) {
      console.error("Falha ao iniciar o cartão de ponto", e);
      return mensagemDaFalha(e);
    }
  };

  const salvarTabela = () =>
    iniciar(async () => {
      setAviso(undefined);
      setAvisoGeral(undefined);
      for (const data of emEdicao) {
        const form = document.getElementById(idDoFormDoDia(data));
        if (!(form instanceof HTMLFormElement)) continue;
        const campos = new FormData(form);
        // Linha que já era vazia e segue vazia não tem o que gravar (cartão novo: só os dias digitados vão).
        const antes = selecionado.dias.find((d) => d.data === data);
        const depois = lerDiaDoFormulario(campos);
        if (antes && !temDados(antes) && depois.ok && !temDados(depois)) continue;
        const erro = await gravar(data, campos);
        if (erro) return setAviso({ data, tipo: "erro", texto: erro });
      }
      // Salvar o cartão novo, mesmo sem nenhum horário, o inicia: daí em diante os dias úteis vazios são falta.
      if (cartaoSemDados(selecionado.dias, selecionado.iniciado)) {
        const falha = await marcarIniciado();
        if (falha) return setAvisoGeral({ tipo: "erro", texto: falha });
      }
      recomecar(emEdicao);
      fechar(emEdicao);
      setFocoNoDia(undefined);
      setDestacada(true);
      setAvisoGeral({ tipo: "sucesso", texto: "Salvo. A Totalização do mês foi atualizada." });
      router.refresh();
    });

  return (
    <CartaoDePonto
      empregado={selecionado.empregado.nome}
      empresa={folha.empresa}
      rotuloMes={rotuloDaCompetencia(folha.competencia)}
      {...navegacaoDoCartao(folha)}
      linhas={linhasDoCartao(selecionado.dias, selecionado.iniciado)}
      totalizacao={itensDaTotalizacao(
        selecionado.totalizacao,
        selecionado.dias.reduce((soma, d) => soma + d.trabalhadoMin, 0),
        cartaoSemDados(selecionado.dias, selecionado.iniciado),
      )}
      avisoDaTotalizacao={selecionado.semConvencao ? AVISO_SEM_CONVENCAO : undefined}
      editavel={folha.podeEditar && selecionado.empregado.ativo}
      pendente={pendente}
      aviso={aviso}
      avisoGeral={avisoGeral}
      empregadoId={selecionado.empregado.id}
      diasEmEdicao={emEdicao}
      diasLimpos={limpos}
      focoNoDia={focoNoDia}
      versoes={versoes}
      listaHref={hrefDaFolha(folha.clienteId, { mes: folha.competencia })}
      totalizacaoDestacada={destacada}
      onEditarDia={(data) => {
        setDestacada(false);
        setAvisoGeral(undefined);
        setFocoNoDia(data);
        setEmEdicao((e) => (e.includes(data) ? e : [...e, data]));
      }}
      onCancelarDia={(data) => {
        setAviso(undefined);
        fechar([data]);
        recomecar([data]);
        setFocoNoDia(data);
      }}
      onAbonarDia={(data) => marcarAbono(data, true)}
      onDesfazerAbonoDia={(data) => marcarAbono(data, false)}
      onSalvarDia={salvarDia}
      onSalvarTabela={salvarTabela}
      onLimparTabela={() => {
        setDestacada(false);
        setAvisoGeral(undefined);
        setLimpos(emEdicao);
        recomecar(emEdicao);
        // O foco fica no botão Limpar (que não some), não pula para uma linha que remonta.
        setFocoNoDia(undefined);
      }}
    />
  );
}
