import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AcaoDaGuia,
  AcoesDasGuias,
} from "@/presentation/components/organisms/guias-da-parcela-pgfn.component";
import { abrirEmNovaAba } from "@/presentation/lib/abrir-em-nova-aba";
import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import { TEXTO_ENVIO_AUTOMATICO } from "@/shared/kernel/dias-do-job-parcelamento";

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
  idDaLiberacao,
  idDaRegiao,
  idDaRemocao,
} from "./anexar-guia-parcela-pgfn.presenter";
import {
  anexarGuiaParcelaPgfnSchema,
  trocarGuiaParcelaPgfnSchema,
} from "./anexar-guia-parcela-pgfn.schema";

const avisoAConfirmar = (
  verbo: "anexada" | "trocada",
  motivo = 'Confira o motivo na lista e, estando certa, use "Confirmar e liberar".',
) => `Guia ${verbo}, mas ainda não liberada ao envio. ${motivo}`;
// Diz também quando a guia sai: a pessoa não fica sem saber o desfecho.
const TEXTO_LIBERADA = `Guia confirmada e liberada ao envio. ${TEXTO_ENVIO_AUTOMATICO}.`;
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
  // Alguma ação em curso; só o envio do PDF ("anexo") troca o rótulo do botão Anexar.
  const [emCurso, setEmCurso] = useState<"anexo" | "outra" | undefined>();
  const pendente = emCurso !== undefined;
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  // "atencao": guia anexada e gravada, mas ainda não liberada (pede conferência; não é sucesso nem erro).
  const [resultado, setResultado] = useState<ResultadoDaAcao | undefined>();
  // Liberar ao envio e remover não se desfazem: pedem confirmação na linha antes de chamar a action.
  // Uma pergunta de risco por vez; `emCurso`: já confirmada, o servidor ainda responde.
  const [acao, setAcao] = useState<AcaoDaGuia | undefined>();

  const lista = useQuery<GuiaDaParcela[]>({
    queryKey: chave,
    queryFn: async () => {
      const resultado = await listarGuiasParcelaPgfnAction({ parcelamentoId });
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
  });

  const limparAvisos = () => {
    setErroServidor(undefined);
    setResultado(undefined);
  };

  // As ações compartilham o ciclo: limpa os avisos, roda, e a lista é relida do banco.
  const executar = async (rodar: () => Promise<string | undefined>, ehAnexo = false) => {
    // Os botões ficam aria-disabled (não perdem o foco) e por isso ainda recebem o clique: ele não
    // some em silêncio: a pessoa é avisada de que há uma ação em curso (espera, não erro).
    if (pendente) {
      setErroServidor(undefined);
      setResultado({ tipo: "atencao", texto: AVISO_AGUARDE });
      return;
    }
    setEmCurso(ehAnexo ? "anexo" : "outra");
    limparAvisos();
    try {
      const erro = await rodar();
      if (erro) setErroServidor(erro);
    } catch {
      setErroServidor(ERRO_TRANSPORTE);
    } finally {
      setEmCurso(undefined);
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
    setAcao(undefined);
    return executar(async () => {
      const resultado = await anexarGuiaParcelaPgfnAction(validado.data);
      // O arquivo e a competência ficam no formulário em caso de erro, para corrigir e reenviar.
      if (!resultado.ok) return resultado.error.message;
      setMes("");
      setContaNegociacao("");
      setArquivo(undefined);
      await avisarGuiaGravada(resultado.data, "anexada");
    }, true);
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
    executar(async () => {
      setAcao(undefined);
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

  const pedirAcao = (tipo: AcaoDaGuia["tipo"], competencia: string) => {
    limparAvisos();
    setAcao({ tipo, competencia, emCurso: false });
  };

  // O botão que abriu a pergunta volta: o foco volta a ele.
  const cancelarAcao = () => {
    const cancelada = acao;
    setAcao(undefined);
    if (!cancelada) return;
    const idDoBotao = cancelada.tipo === "liberar" ? idDaLiberacao : idDaRemocao;
    requestAnimationFrame(() =>
      document.getElementById(idDoBotao(prefixo, cancelada.competencia))?.focus(),
    );
  };

  // A pergunta fica aberta enquanto o servidor responde (o botão mostra "Removendo..." ou "Liberando...").
  const comAcao = (
    tipo: AcaoDaGuia["tipo"],
    competencia: string,
    rodar: () => Promise<string | undefined>,
  ) =>
    executar(async () => {
      setAcao({ tipo, competencia, emCurso: true });
      try {
        return await rodar();
      } finally {
        setAcao(undefined);
      }
    });

  const remover = (competencia: string) =>
    comAcao("remover", competencia, async () => {
      const resultado = await removerGuiaParcelaPgfnAction({ parcelamentoId, competencia });
      if (!resultado.ok) return resultado.error.message;
      setResultado({ tipo: "sucesso", texto: "Guia removida." });
      await queryClient.invalidateQueries({ queryKey: chave });
      // A linha some com o botão: sem isto o foco cairia no topo da página.
      document.getElementById(idDaRegiao(prefixo))?.focus();
    });

  const visualizar = (competencia: string) =>
    executar(async () => {
      const aba = await abrirEmNovaAba(() =>
        obterLinkGuiaParcelaPgfnAction({ parcelamentoId, competencia }),
      );
      if (aba.tipo === "erro") return aba.mensagem;
      if (aba.tipo === "bloqueada") return ERRO_ABRIR;
    });

  const confirmar = (competencia: string) =>
    comAcao("liberar", competencia, async () => {
      const resultado = await confirmarGuiaParcelaPgfnAction({ parcelamentoId, competencia });
      if (!resultado.ok) return resultado.error.message;
      setResultado({ tipo: "sucesso", texto: TEXTO_LIBERADA });
      await queryClient.invalidateQueries({ queryKey: chave });
      // O botão Confirmar some com a guia confirmada: sem isto o foco cairia no topo da página.
      document.getElementById(idDaGuia(prefixo, competencia))?.focus();
    });

  // Mexer num campo tira da tela o aviso do anexo anterior, a recusa do servidor e o erro daquele campo.
  const aoEditar =
    <T>(campo: keyof Erros, definir: (valor: T) => void) =>
    (valor: T) => {
      limparAvisos();
      setErros((atuais) => ({ ...atuais, [campo]: undefined }));
      definir(valor);
    };

  const acoes: AcoesDasGuias = {
    pedir: pedirAcao,
    cancelar: cancelarAcao,
    confirmar: (competencia) => void confirmar(competencia),
    trocar: (competencia, arquivo) => void trocar(competencia, arquivo),
    remover: (competencia) => void remover(competencia),
    visualizar: (competencia) => void visualizar(competencia),
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
    anexando: emCurso === "anexo",
    erroServidor,
    resultado,
    anexar,
    acao,
    acoes,
  };
}
