"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  idDoFormDoDia,
  type AvisoDoDia,
} from "@/presentation/components/molecules/linha-do-cartao-de-ponto.component";
import { CartaoDePonto } from "@/presentation/components/organisms/cartao-de-ponto.component";
import { baixarArquivoBase64 } from "@/presentation/lib/baixar-arquivo-base64";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";
import type { ActionResult } from "@/shared/dtos/action-result.dto";

import {
  baixarPdfDoCartaoAction,
  iniciarCartaoDoPontoAction,
  salvarDiaDoPontoAction,
} from "./folha-de-ponto.actions";
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
import { LeituraDeAtestadoContainer } from "./leitura-de-atestado.container";

type Props = { folha: FolhaDePontoDto };

export function CartaoDePontoContainer({ folha }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [baixandoPdf, iniciarPdf] = useTransition();
  const [avisoDoPdf, setAvisoDoPdf] = useState<AvisoDoDia>();
  const [aviso, setAviso] = useState<AvisoDoDia & { data: string }>();
  const [avisoGeral, setAvisoGeral] = useState<AvisoDoDia>();
  const [emEdicao, setEmEdicao] = useState<string[]>(() =>
    folha.selecionado && cartaoSemDados(folha.selecionado.dias, folha.selecionado.iniciado)
      ? folha.selecionado.dias.map((d) => d.data)
      : [],
  );
  const [limpos, setLimpos] = useState<string[]>([]);
  const [versoes, setVersoes] = useState<Record<string, number>>({});
  const [destacada, setDestacada] = useState(false);
  const [focoNoDia, setFocoNoDia] = useState<string>();
  const { selecionado } = folha;
  if (!selecionado) return null;

  const cartaoNovo = cartaoSemDados(selecionado.dias, selecionado.iniciado);

  const recomecar = (datas: string[]) =>
    setVersoes((v) => ({ ...v, ...Object.fromEntries(datas.map((d) => [d, (v[d] ?? 0) + 1])) }));
  const fechar = (datas: string[]) => {
    setEmEdicao((e) => e.filter((d) => !datas.includes(d)));
    setLimpos((l) => l.filter((d) => !datas.includes(d)));
  };

  const tentar = async (
    falha: string,
    acao: () => Promise<ActionResult<unknown>>,
  ): Promise<string | undefined> => {
    try {
      const resultado = await acao();
      return resultado.ok ? undefined : resultado.error.message;
    } catch (e) {
      console.error(falha, e);
      return mensagemDaFalha(e);
    }
  };

  const limparAvisos = () => {
    setAviso(undefined);
    setAvisoGeral(undefined);
    setAvisoDoPdf(undefined);
  };

  const gravar = async (data: string, campos: FormData): Promise<string | undefined> => {
    const lido = lerDiaDoFormulario(campos);
    if (!lido.ok) return lido.erro;
    return tentar("Falha ao salvar o dia do cartão de ponto", () =>
      salvarDiaDoPontoAction({
        empregadoId: selecionado.empregado.id,
        data,
        batidas: lido.batidas,
        extra: lido.extra,
        abono: lido.abono,
      }),
    );
  };

  const salvarDia = (data: string, campos: FormData) =>
    iniciar(async () => {
      limparAvisos();
      const erro = await gravar(data, campos);
      if (erro) return setAviso({ data, tipo: "erro", texto: erro });
      setAviso({ data, tipo: "sucesso", texto: "Salvo." });
      fechar([data]);
      recomecar([data]);
      setFocoNoDia(data);
      router.refresh();
    });

  const marcarAbono = (data: string, abono: boolean) =>
    iniciar(async () => {
      limparAvisos();
      const erro = await tentar("Falha ao abonar o dia do cartão de ponto", () =>
        salvarDiaDoPontoAction({
          empregadoId: selecionado.empregado.id,
          data,
          batidas: [],
          extra: null,
          abono,
        }),
      );
      if (erro) return setAviso({ data, tipo: "erro", texto: erro });
      setAviso({ data, tipo: "sucesso", texto: abono ? "Abonado." : "Abono desfeito." });
      recomecar([data]);
      setFocoNoDia(data);
      router.refresh();
    });

  const marcarIniciado = () =>
    tentar("Falha ao iniciar o cartão de ponto", () =>
      iniciarCartaoDoPontoAction({
        empregadoId: selecionado.empregado.id,
        competencia: folha.competencia,
      }),
    );

  const salvarTabela = () =>
    iniciar(async () => {
      limparAvisos();
      for (const data of emEdicao) {
        const form = document.getElementById(idDoFormDoDia(data));
        if (!(form instanceof HTMLFormElement)) continue;
        const campos = new FormData(form);
        const antes = selecionado.dias.find((d) => d.data === data);
        const depois = lerDiaDoFormulario(campos);
        if (antes && !temDados(antes) && depois.ok && !temDados(depois)) continue;
        const erro = await gravar(data, campos);
        if (erro) return setAviso({ data, tipo: "erro", texto: erro });
      }
      if (cartaoNovo) {
        const falha = await marcarIniciado();
        if (falha) {
          router.refresh();
          return setAvisoGeral({
            tipo: "erro",
            texto: `Não foi possível iniciar o cartão: ${falha} Tente salvar de novo.`,
          });
        }
      }
      recomecar(emEdicao);
      fechar(emEdicao);
      setFocoNoDia(undefined);
      setDestacada(true);
      setAvisoGeral({
        tipo: "sucesso",
        texto: cartaoNovo
          ? "Cartão iniciado: os dias úteis sem horário viraram falta. A Totalização do mês foi atualizada."
          : "Salvo. A Totalização do mês foi atualizada.",
      });
      router.refresh();
    });

  const aposAtestado = (resumo: string) => {
    limparAvisos();
    recomecar(selecionado.dias.map((d) => d.data).filter((d) => !emEdicao.includes(d)));
    setAvisoGeral({ tipo: "sucesso", texto: resumo });
    router.refresh();
  };

  const baixarPdf = () =>
    iniciarPdf(async () => {
      setAvisoDoPdf(undefined);
      const erro = await tentar("Falha ao baixar o PDF do cartão de ponto", async () => {
        const resultado = await baixarPdfDoCartaoAction({
          clienteId: folha.clienteId,
          empregadoId: selecionado.empregado.id,
          competencia: folha.competencia,
        });
        if (resultado.ok) {
          baixarArquivoBase64(
            resultado.data.nomeDoArquivo,
            resultado.data.base64,
            "application/pdf",
          );
        }
        return resultado;
      });
      setAvisoDoPdf(
        erro
          ? { tipo: "erro", texto: erro }
          : { tipo: "sucesso", texto: "PDF gerado. Confira o arquivo baixado." },
      );
    });

  const editavel = folha.podeEditar && selecionado.empregado.ativo;

  return (
    <CartaoDePonto
      acaoDeAtestado={
        editavel ? (
          <LeituraDeAtestadoContainer
            empregadoId={selecionado.empregado.id}
            nomeDoEmpregado={selecionado.empregado.nome}
            aoAbonar={aposAtestado}
          />
        ) : undefined
      }
      empregado={selecionado.empregado.nome}
      empresa={folha.empresa}
      rotuloMes={rotuloDaCompetencia(folha.competencia)}
      {...navegacaoDoCartao(folha)}
      linhas={linhasDoCartao(selecionado.dias, selecionado.iniciado)}
      totalizacao={itensDaTotalizacao(
        selecionado.totalizacao,
        selecionado.dias.reduce((soma, d) => soma + d.trabalhadoMin, 0),
        cartaoNovo,
      )}
      cartaoNovo={cartaoNovo && selecionado.empregado.ativo}
      avisoDaTotalizacao={selecionado.semConvencao ? AVISO_SEM_CONVENCAO : undefined}
      editavel={editavel}
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
      onBaixarPdf={baixarPdf}
      baixandoPdf={baixandoPdf}
      avisoDoPdf={avisoDoPdf}
      motivoSemPdf={selecionado.motivoSemPdf}
      onLimparTabela={() => {
        setDestacada(false);
        setAvisoGeral(undefined);
        setLimpos(emEdicao);
        recomecar(emEdicao);
        setFocoNoDia(undefined);
      }}
    />
  );
}
