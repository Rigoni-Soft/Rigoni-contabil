import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";

import {
  anexarGuiaParcelaPgfnAction,
  confirmarGuiaParcelaPgfnAction,
  listarGuiasParcelaPgfnAction,
} from "./anexar-guia-parcela-pgfn.actions";
import { competenciaDoMes, idDaGuia } from "./anexar-guia-parcela-pgfn.presenter";
import { anexarGuiaParcelaPgfnSchema } from "./anexar-guia-parcela-pgfn.schema";

const ERRO_TRANSPORTE = "Não foi possível concluir agora. Verifique a conexão e tente novamente.";

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
  const [acaoEmCurso, setAcaoEmCurso] = useState<"anexar" | "confirmar" | undefined>();
  const pendente = acaoEmCurso !== undefined;
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState<string | undefined>();

  const lista = useQuery<GuiaDaParcela[]>({
    queryKey: chave,
    queryFn: async () => {
      const resultado = await listarGuiasParcelaPgfnAction({ parcelamentoId });
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
  });

  // Anexar e confirmar compartilham o ciclo: limpa os avisos, roda, e a lista é relida do banco.
  const executar = async (
    qual: "anexar" | "confirmar",
    acao: () => Promise<string | undefined>,
  ) => {
    // Os botões ficam aria-disabled (não perdem o foco) e por isso ainda recebem o clique.
    if (pendente) return;
    setAcaoEmCurso(qual);
    setErroServidor(undefined);
    setSucesso(undefined);
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
      setSucesso("Guia anexada. Confirme para liberá-la ao envio.");
      await queryClient.invalidateQueries({ queryKey: chave });
    });
  };

  const confirmar = (competencia: string) =>
    executar("confirmar", async () => {
      const resultado = await confirmarGuiaParcelaPgfnAction({ parcelamentoId, competencia });
      if (!resultado.ok) return resultado.error.message;
      setSucesso("Guia confirmada.");
      await queryClient.invalidateQueries({ queryKey: chave });
      // O botão Confirmar some com a guia confirmada: sem isto o foco cairia no topo da página.
      document.getElementById(idDaGuia(prefixo, competencia))?.focus();
    });

  // Mexer num campo tira da tela o aviso do anexo anterior, a recusa do servidor e o erro daquele campo.
  const aoEditar =
    <T>(campo: keyof Erros, definir: (valor: T) => void) =>
    (valor: T) => {
      setSucesso(undefined);
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
    sucesso,
    anexar,
    confirmar,
  };
}
