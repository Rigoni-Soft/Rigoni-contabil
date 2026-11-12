"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  ID_DO_RESULTADO,
  QuadroDeFuncionarios,
} from "@/presentation/components/organisms/quadro-de-funcionarios.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";
import type { ActionResult } from "@/shared/dtos/action-result.dto";

import {
  cadastrarEmpregadoAction,
  corrigirEmpregadoAction,
  definirEmpregadoAtivoAction,
  definirPadraoComissionadosAction,
  definirSemMovimentoAction,
} from "./folha-de-ponto.actions";
import {
  empregadoEmEdicao,
  hrefDaFolha,
  JORNADA_PADRAO,
  lerEmpregadoDoFormulario,
  quadroDoEmpregado,
} from "./folha-de-ponto.presenter";

type Props = { folha: FolhaDePontoDto };

// O quadro do Cliente: cadastrar, corrigir, inativar, "sem movimento no mês" e o padrão de comissionados.
export function QuadroDeFuncionariosContainer({ folha }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string>();
  const [erroDoNovo, setErroDoNovo] = useState<string>();
  const [chaveDoNovo, setChaveDoNovo] = useState(0);
  const [resultado, setResultado] = useState<string>();
  const escolhido = folha.selecionado?.empregado;

  // Depois de desligar ou readmitir o Editar some com o botão clicado: o foco vai ao aviso do resultado.
  useEffect(() => {
    if (resultado) document.getElementById(ID_DO_RESULTADO)?.focus();
  }, [resultado]);

  // Toda escrita compartilha o ciclo: erro do servidor, recarga da tela e falha de transporte.
  const executar = (
    acao: () => Promise<ActionResult<void>>,
    {
      cadastro = false,
      fecharEdicao,
    }: { cadastro?: boolean; fecharEdicao?: { resultado: string } } = {},
  ) =>
    iniciar(async () => {
      const falhar = cadastro ? setErroDoNovo : setErro;
      setErro(undefined);
      setErroDoNovo(undefined);
      setResultado(undefined);
      try {
        const r = await acao();
        if (!r.ok) return falhar(r.error.message);
        // Só o sucesso limpa o formulário do novo empregado: a recusa preserva o que foi digitado.
        if (cadastro) setChaveDoNovo((c) => c + 1);
        // Desligar e readmitir já gravam: o Editar fecha e a tela volta ao formulário "Novo empregado".
        if (fecharEdicao) {
          setResultado(fecharEdicao.resultado);
          return router.push(hrefDaFolha(folha.clienteId, { mes: folha.competencia }));
        }
        router.refresh();
      } catch (e) {
        console.error("Falha ao gravar o quadro de funcionários", e);
        falhar(mensagemDaFalha(e));
      }
    });

  return (
    <QuadroDeFuncionarios
      empregados={quadroDoEmpregado(folha)}
      emEdicao={empregadoEmEdicao(folha)}
      padraoComissionados={folha.padraoComissionados}
      rotuloMes={rotuloDaCompetencia(folha.competencia)}
      editavel={folha.podeEditar}
      pendente={pendente}
      erro={erro}
      erroDoNovo={erroDoNovo}
      chaveDoNovo={chaveDoNovo}
      resultado={resultado}
      novoHref={hrefDaFolha(folha.clienteId, { mes: folha.competencia })}
      onCadastrar={(campos) => {
        const lido = lerEmpregadoDoFormulario(campos);
        executar(
          () =>
            cadastrarEmpregadoAction({
              clienteId: folha.clienteId,
              nome: lido.nome,
              jornada: JORNADA_PADRAO,
              comissionado: lido.comissionado,
            }),
          { cadastro: true },
        );
      }}
      onCorrigir={(campos) => {
        const lido = lerEmpregadoDoFormulario(campos);
        if (!escolhido) return;
        executar(() =>
          corrigirEmpregadoAction({
            empregadoId: escolhido.id,
            nome: lido.nome,
            jornada: escolhido.jornada,
            comissionado: lido.comissionado,
          }),
        );
      }}
      onAtivo={(ativo) =>
        escolhido &&
        executar(() => definirEmpregadoAtivoAction({ empregadoId: escolhido.id, ativo }), {
          fecharEdicao: {
            resultado: ativo
              ? `${escolhido.nome}: readmissão registrada.`
              : `${escolhido.nome}: desligamento registrado.`,
          },
        })
      }
      onSemMovimento={(sem) =>
        escolhido &&
        executar(() =>
          definirSemMovimentoAction({
            empregadoId: escolhido.id,
            competencia: folha.competencia,
            sem,
          }),
        )
      }
      onPadrao={(comissionados) =>
        executar(() =>
          definirPadraoComissionadosAction({ clienteId: folha.clienteId, comissionados }),
        )
      }
    />
  );
}
