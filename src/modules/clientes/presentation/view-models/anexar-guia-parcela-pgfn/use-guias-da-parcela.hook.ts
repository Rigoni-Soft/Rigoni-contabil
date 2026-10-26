import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";

import {
  anexarGuiaParcelaPgfnAction,
  confirmarGuiaParcelaPgfnAction,
  listarGuiasParcelaPgfnAction,
  obterLinkGuiaParcelaPgfnAction,
  removerGuiaParcelaPgfnAction,
  trocarGuiaParcelaPgfnAction,
} from "./anexar-guia-parcela-pgfn.actions";
import {
  competenciaDoMes,
  idDaGuia,
  idDaRegiao,
  idDaRemocao,
} from "./anexar-guia-parcela-pgfn.presenter";
import {
  anexarGuiaParcelaPgfnSchema,
  trocarGuiaParcelaPgfnSchema,
} from "./anexar-guia-parcela-pgfn.schema";

const avisoAConfirmar = (
  verbo: "anexada" | "trocada",
  motivo = "Confira o motivo na lista e confirme.",
) => `Guia ${verbo}, mas ainda não liberada ao envio. ${motivo}`;
const AVISO_AGUARDE = "Aguarde a ação em andamento terminar.";
const ERRO_ABRIR = "Não foi possível abrir a guia. Tente novamente.";
const ERRO_TRANSPORTE = "Não foi possível concluir agora. Verifique a conexão e tente novamente.";

type ResultadoDaAcao = { tipo: "sucesso" | "atencao"; texto: string };

type Erros = { competencia?: string; contaNegociacao?: string; arquivo?: string };

// `prefixo`: o mesmo que a View usa nos ids; o foco volta ao item da guia confirmada.
export function useGuiasDaParcela(parcelamentoId: string, prefixo: string) {
  const queryClient = useQueryClient();
  const chave = ["clientes", "guias-parcela-pgfn", parcelamentoId];
  const [mes, setMes] = useState("");
  const [contaNegociacao, setContaNegociacao] = useState("");
  const [arquivo, setArquivo] = useState<File | undefined>();
  const [erros, setErros] = useState<Erros>({});
  // Qual ação está em curso: só o envio do PDF troca o rótulo do botão Anexar.
  const [acaoEmCurso, setAcaoEmCurso] = useState<
    "anexar" | "confirmar" | "trocar" | "remover" | "ver" | undefined
  >();
  const pendente = acaoEmCurso !== undefined;
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  // "atencao": guia anexada e gravada, mas ainda não liberada (pede conferência; não é sucesso nem erro).
  const [resultado, setResultado] = useState<ResultadoDaAcao | undefined>();
  // Remover apaga o registro e o PDF sem desfazer: pede confirmação na linha antes de chamar a action.
  const [removendo, setRemovendo] = useState<string | undefined>();

  const lista = useQuery<GuiaDaParcela[]>({
    queryKey: chave,
    queryFn: async () => {
      const resultado = await listarGuiasParcelaPgfnAction({ parcelamentoId });
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
  });

  // As ações compartilham o ciclo: limpa os avisos, roda, e a lista é relida do banco.
  const executar = async (
    qual: NonNullable<typeof acaoEmCurso>,
    acao: () => Promise<string | undefined>,
  ) => {
    // Os botões ficam aria-disabled (não perdem o foco) e por isso ainda recebem o clique: ele não
    // some em silêncio: a pessoa é avisada de que há uma ação em curso (espera, não erro).
    if (pendente) {
      setErroServidor(undefined);
      setResultado({ tipo: "atencao", texto: AVISO_AGUARDE });
      return;
    }
    setAcaoEmCurso(qual);
    setErroServidor(undefined);
    setResultado(undefined);
    try {
      const erro = await acao();
      if (erro) setErroServidor(erro);
    } catch {
      setErroServidor(ERRO_TRANSPORTE);
    } finally {
      setAcaoEmCurso(undefined);
    }
  };

  const anexar = async () => {
    const entrada = {
      parcelamentoId,
      competencia: competenciaDoMes(mes),
      contaNegociacao,
      arquivo,
    };
    const validado = anexarGuiaParcelaPgfnSchema.safeParse(entrada);
    if (!validado.success) {
      const campos = validado.error.flatten().fieldErrors;
      setErros({
        competencia: campos.competencia?.[0],
        contaNegociacao: campos.contaNegociacao?.[0],
        arquivo: campos.arquivo?.[0],
      });
      return;
    }
    setErros({});
    return executar("anexar", async () => {
      const resultado = await anexarGuiaParcelaPgfnAction(validado.data);
      // O arquivo e a competência ficam no formulário em caso de erro, para corrigir e reenviar.
      if (!resultado.ok) return resultado.error.message;
      setMes("");
      setContaNegociacao("");
      setArquivo(undefined);
      await avisarGuiaGravada(resultado.data, "anexada");
    });
  };

  // Anexo e troca terminam igual: aviso de confirmada, ou de "a confirmar" com o que conferir.
  const avisarGuiaGravada = async (guia: GuiaDaParcela, verbo: "anexada" | "trocada") => {
    const confirmada = guia.estado === "confirmada";
    // Sai já, sem esperar a lista.
    setResultado(
      confirmada
        ? { tipo: "sucesso", texto: `Guia ${verbo} e confirmada: liberada ao envio.` }
        : { tipo: "atencao", texto: avisoAConfirmar(verbo) },
    );
    await queryClient.invalidateQueries({ queryKey: chave });
    if (confirmada) return;
    // Exceção: o motivo não está na lista (a confirmação automática falhou e esse motivo não é
    // gravado); o aviso passa a trazê-lo, se ainda estiver na tela (a pessoa pode tê-lo limpado).
    const naLista = queryClient
      .getQueryData<GuiaDaParcela[]>(chave)
      ?.find((g) => g.competencia === guia.competencia)?.motivo;
    if (!naLista && guia.motivo) {
      const comMotivo = avisoAConfirmar(verbo, guia.motivo);
      setResultado((atual) => (atual ? { tipo: "atencao", texto: comMotivo } : atual));
    }
  };

  const trocar = (competencia: string, novo: File) =>
    executar("trocar", async () => {
      const validado = trocarGuiaParcelaPgfnSchema.safeParse({
        parcelamentoId,
        competencia,
        arquivo: novo,
      });
      if (!validado.success) return validado.error.issues[0].message;
      const resultado = await trocarGuiaParcelaPgfnAction(validado.data);
      if (!resultado.ok) return resultado.error.message;
      await avisarGuiaGravada(resultado.data, "trocada");
    });

  const pedirRemocao = (competencia: string) => {
    setResultado(undefined);
    setErroServidor(undefined);
    setRemovendo(competencia);
  };

  const cancelarRemocao = (competencia: string) => {
    setRemovendo(undefined);
    // O botão Remover volta com a confirmação fechada: o foco volta a ele.
    requestAnimationFrame(() =>
      document.getElementById(idDaRemocao(prefixo, competencia))?.focus(),
    );
  };

  const remover = (competencia: string) =>
    executar("remover", async () => {
      setRemovendo(undefined);
      const resultado = await removerGuiaParcelaPgfnAction({ parcelamentoId, competencia });
      if (!resultado.ok) return resultado.error.message;
      setResultado({ tipo: "sucesso", texto: "Guia removida." });
      await queryClient.invalidateQueries({ queryKey: chave });
      // A linha some com o botão: sem isto o foco cairia no topo da página.
      document.getElementById(idDaRegiao(prefixo))?.focus();
    });

  const visualizar = (competencia: string) =>
    executar("ver", async () => {
      // A aba abre no clique (senão o bloqueador de pop-up barra) e recebe o link depois que a
      // Server Action devolve; `opener` zerado no lugar de `noopener`, para guardar a referência.
      const aba = window.open("about:blank", "_blank");
      if (aba) aba.opener = null;
      try {
        const resultado = await obterLinkGuiaParcelaPgfnAction({ parcelamentoId, competencia });
        if (resultado.ok && aba) {
          aba.location.href = resultado.data.url;
          return;
        }
        aba?.close();
        return resultado.ok ? ERRO_ABRIR : resultado.error.message;
      } catch (erro) {
        aba?.close();
        throw erro;
      }
    });

  const confirmar = (competencia: string) =>
    executar("confirmar", async () => {
      const resultado = await confirmarGuiaParcelaPgfnAction({ parcelamentoId, competencia });
      if (!resultado.ok) return resultado.error.message;
      setResultado({ tipo: "sucesso", texto: "Guia confirmada." });
      await queryClient.invalidateQueries({ queryKey: chave });
      // O botão Confirmar some com a guia confirmada: sem isto o foco cairia no topo da página.
      document.getElementById(idDaGuia(prefixo, competencia))?.focus();
    });

  // Mexer num campo tira da tela o aviso do anexo anterior, a recusa do servidor e o erro daquele campo.
  const aoEditar =
    <T>(campo: keyof Erros, definir: (valor: T) => void) =>
    (valor: T) => {
      setResultado(undefined);
      setErroServidor(undefined);
      setErros((atuais) => ({ ...atuais, [campo]: undefined }));
      definir(valor);
    };

  return {
    guias: lista.data ?? [],
    carregando: lista.isLoading,
    erroDaLista: lista.isError ? "Não foi possível carregar as guias anexadas." : undefined,
    recarregar: () => void lista.refetch(),
    mes,
    setMes: aoEditar("competencia", setMes),
    contaNegociacao,
    setContaNegociacao: aoEditar("contaNegociacao", setContaNegociacao),
    arquivo,
    setArquivo: aoEditar("arquivo", setArquivo),
    erros,
    pendente,
    anexando: acaoEmCurso === "anexar",
    erroServidor,
    resultado,
    anexar,
    confirmar,
    trocar,
    removendo,
    pedirRemocao,
    cancelarRemocao,
    remover,
    visualizar,
  };
}
