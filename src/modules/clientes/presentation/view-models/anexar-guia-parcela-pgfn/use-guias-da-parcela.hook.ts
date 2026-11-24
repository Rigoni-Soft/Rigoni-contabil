import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  type AcaoDaGuia,
  type AcoesDasGuias,
  type DadosDoAnexo,
  type ResultadoDaGuia,
} from "./anexar-guia-parcela-pgfn.presenter";
import {
  anexarGuiaParcelaPgfnSchema,
  trocarGuiaParcelaPgfnSchema,
} from "./anexar-guia-parcela-pgfn.schema";

const avisoAConfirmar = (
  verbo: "anexada" | "trocada",
  motivo = 'Confira o motivo na lista e, estando certa, use "Confirmar e liberar".',
) => `Guia ${verbo}, mas ainda não liberada ao envio. ${motivo}`;
const TEXTO_LIBERADA = `Guia confirmada e liberada ao envio. ${TEXTO_ENVIO_AUTOMATICO}.`;
const AVISO_AGUARDE = "Aguarde a ação em andamento terminar.";
const ERRO_ABRIR = "Não foi possível abrir a guia. Tente novamente.";
const ERRO_TRANSPORTE = "Não foi possível concluir agora. Verifique a conexão e tente novamente.";

export function useGuiasDaParcela(parcelamentoId: string, prefixo: string) {
  const queryClient = useQueryClient();
  const chave = ["clientes", "guias-parcela-pgfn", parcelamentoId];
  const [mes, setMes] = useState("");
  const [contaNegociacao, setContaNegociacao] = useState("");
  const [arquivo, setArquivo] = useState<File | undefined>();
  const [erros, setErros] = useState<DadosDoAnexo["erros"]>({});
  const [emCurso, setEmCurso] = useState<"anexo" | "outra" | undefined>();
  const pendente = emCurso !== undefined;
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  const [resultado, setResultado] = useState<ResultadoDaGuia | undefined>();
  const [acao, setAcao] = useState<AcaoDaGuia | undefined>();

  const lista = useQuery<GuiaDaParcela[]>({
    queryKey: chave,
    staleTime: 30_000,
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

  const executar = async (rodar: () => Promise<string | undefined>, ehAnexo = false) => {
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
      if (!resultado.ok) return resultado.error.message;
      setMes("");
      setContaNegociacao("");
      setArquivo(undefined);
      await avisarGuiaGravada(resultado.data, "anexada");
    }, true);
  };

  const avisarGuiaGravada = async (guia: GuiaDaParcela, verbo: "anexada" | "trocada") => {
    setResultado(
      guia.estado === "confirmada"
        ? { tipo: "sucesso", texto: `Guia ${verbo} e confirmada: liberada ao envio.` }
        : { tipo: "atencao", texto: avisoAConfirmar(verbo, guia.motivo) },
    );
    await queryClient.invalidateQueries({ queryKey: chave });
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

  const cancelarAcao = () => {
    const cancelada = acao;
    setAcao(undefined);
    if (!cancelada) return;
    const idDoBotao = cancelada.tipo === "liberar" ? idDaLiberacao : idDaRemocao;
    requestAnimationFrame(() =>
      document.getElementById(idDoBotao(prefixo, cancelada.competencia))?.focus(),
    );
  };

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
      const versao = lista.data?.find((g) => g.competencia === competencia)?.versao;
      if (!versao) return "Não encontramos esta guia. Atualize a página.";
      const resultado = await confirmarGuiaParcelaPgfnAction({
        parcelamentoId,
        competencia,
        versao,
      });
      if (!resultado.ok) {
        await queryClient.invalidateQueries({ queryKey: chave });
        return resultado.error.message;
      }
      setResultado({ tipo: "sucesso", texto: TEXTO_LIBERADA });
      await queryClient.invalidateQueries({ queryKey: chave });
      document.getElementById(idDaGuia(prefixo, competencia))?.focus();
    });

  const aoEditar =
    <T>(campo: keyof DadosDoAnexo["erros"], definir: (valor: T) => void) =>
    (valor: T) => {
      limparAvisos();
      setErros((atuais) => ({ ...atuais, [campo]: undefined }));
      definir(valor);
    };

  const acoes: AcoesDasGuias = {
    pedir: pedirAcao,
    anexar: () => void anexar(),
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
    anexo: {
      competencia: mes,
      onCompetencia: aoEditar("competencia", setMes),
      contaNegociacao,
      onContaNegociacao: aoEditar("contaNegociacao", setContaNegociacao),
      arquivo,
      onArquivo: aoEditar("arquivo", setArquivo),
      erros,
    },
    pendente,
    anexando: emCurso === "anexo",
    erroServidor,
    resultado,
    acao,
    acoes,
  };
}
