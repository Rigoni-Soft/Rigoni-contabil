"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ServicosDoAcompanhamento } from "@/presentation/components/organisms/servicos-do-acompanhamento.component";
import { TabelaDeAcompanhamento } from "@/presentation/components/organisms/tabela-de-acompanhamento.component";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { ROTA_RH } from "@/shared/kernel/setores";

import {
  criarServicoAction,
  definirServicoAplicavelAction,
  desativarServicoAction,
  marcarServicoAction,
  renomearServicoAction,
} from "./acompanhamento-mensal.actions";
import type { LinhaDaTabela } from "./acompanhamento-mensal.presenter";

type Props = {
  competencia: string;
  meses: { valor: string; rotulo: string }[];
  servicos: { id: string; nome: string; sistema: boolean }[];
  linhas: LinhaDaTabela[];
  podeMarcar: boolean;
  // O Líder mantém os serviços só no mês corrente (a lista é a de agora).
  podeGerirServicos: boolean;
};

export function AcompanhamentoMensalContainer({
  competencia,
  meses,
  servicos,
  linhas,
  podeMarcar,
  podeGerirServicos,
}: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string>();
  const [novoNome, setNovoNome] = useState("");

  // Toda escrita compartilha o ciclo: erro do servidor, recarga da tabela e retorno de sucesso.
  const executar = (acao: () => Promise<ActionResult<void>>, aoDarCerto?: () => void) =>
    iniciar(async () => {
      setErro(undefined);
      try {
        const r = await acao();
        if (!r.ok) return setErro(r.error.message);
        aoDarCerto?.();
        router.refresh();
      } catch {
        setErro("Falha inesperada. Tente novamente.");
      }
    });

  return (
    <>
      <TabelaDeAcompanhamento
        competencia={competencia}
        meses={meses}
        action={`${ROTA_RH}/acompanhamento`}
        servicos={servicos}
        linhas={linhas}
        podeAlterar={podeMarcar}
        pendente={pendente}
        erro={erro}
        onMarcar={(clienteId, servicoId, concluido) =>
          executar(() => marcarServicoAction({ clienteId, servicoId, competencia, concluido }))
        }
        onAplicar={(clienteId, servicoId, aplica) =>
          executar(() => definirServicoAplicavelAction({ clienteId, servicoId, aplica }))
        }
      />
      {podeGerirServicos && (
        <ServicosDoAcompanhamento
          servicos={servicos}
          novoNome={novoNome}
          onNovoNome={setNovoNome}
          pendente={pendente}
          erro={erro}
          onCriar={() =>
            executar(
              () => criarServicoAction({ nome: novoNome }),
              () => setNovoNome(""),
            )
          }
          onRenomear={(servicoId, atual) => {
            const nome = window.prompt("Novo nome do serviço", atual)?.trim();
            if (nome && nome !== atual) executar(() => renomearServicoAction({ servicoId, nome }));
          }}
          onDesativar={(servicoId) => executar(() => desativarServicoAction({ servicoId }))}
        />
      )}
    </>
  );
}
