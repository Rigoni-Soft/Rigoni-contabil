"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { QuadroDeFuncionarios } from "@/presentation/components/organisms/quadro-de-funcionarios.component";
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
  CARGAS_PADRAO,
  empregadoEmEdicao,
  lerEmpregadoDoFormulario,
  quadroDoEmpregado,
} from "./folha-de-ponto.presenter";

type Props = { folha: FolhaDePontoDto };

// O quadro do Cliente: cadastrar, corrigir, inativar, "sem movimento no mês" e o padrão de comissionados.
export function QuadroDeFuncionariosContainer({ folha }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string>();
  const escolhido = folha.selecionado?.empregado;

  // Toda escrita compartilha o ciclo: erro do servidor, recarga da tela e falha de transporte.
  const executar = (acao: () => Promise<ActionResult<void>>) =>
    iniciar(async () => {
      setErro(undefined);
      try {
        const r = await acao();
        if (!r.ok) return setErro(r.error.message);
        router.refresh();
      } catch (e) {
        console.error("Falha ao gravar o quadro de funcionários", e);
        setErro(mensagemDaFalha(e));
      }
    });

  return (
    <QuadroDeFuncionarios
      empregados={quadroDoEmpregado(folha)}
      emEdicao={empregadoEmEdicao(folha)}
      cargasPadrao={CARGAS_PADRAO}
      padraoComissionados={folha.padraoComissionados}
      rotuloMes={rotuloDaCompetencia(folha.competencia)}
      editavel={folha.podeEditar}
      pendente={pendente}
      erro={erro}
      onCadastrar={(campos) => {
        const lido = lerEmpregadoDoFormulario(campos);
        if (!lido.ok) return setErro(lido.erro);
        executar(() =>
          cadastrarEmpregadoAction({
            clienteId: folha.clienteId,
            nome: lido.nome,
            jornada: lido.jornada,
            comissionado: lido.comissionado,
          }),
        );
      }}
      onCorrigir={(campos) => {
        const lido = lerEmpregadoDoFormulario(campos);
        if (!lido.ok) return setErro(lido.erro);
        if (!escolhido) return;
        executar(() =>
          corrigirEmpregadoAction({
            empregadoId: escolhido.id,
            nome: lido.nome,
            jornada: lido.jornada,
            comissionado: lido.comissionado,
          }),
        );
      }}
      onAtivo={(ativo) =>
        escolhido &&
        executar(() => definirEmpregadoAtivoAction({ empregadoId: escolhido.id, ativo }))
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
