"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ServicosDoAcompanhamento } from "@/presentation/components/organisms/servicos-do-acompanhamento.component";
import { TabelaDeAcompanhamento } from "@/presentation/components/organisms/tabela-de-acompanhamento.component";
import type { ActionResult } from "@/shared/dtos/action-result.dto";

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
  rotuloCompetencia: string;
  anteriorHref: string;
  proximoHref?: string;
  servicos: { id: string; nome: string; sistema: boolean }[];
  linhas: LinhaDaTabela[];
  podeMarcar: boolean;
  // O Líder mantém os serviços só no mês corrente (a lista é a de agora).
  podeGerirServicos: boolean;
};

export function AcompanhamentoMensalContainer({
  competencia,
  rotuloCompetencia,
  anteriorHref,
  proximoHref,
  servicos,
  linhas,
  podeMarcar,
  podeGerirServicos,
}: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<{ onde: "tabela" | "servicos"; mensagem: string }>();
  const [desativando, setDesativando] = useState<string>();
  const [novoNome, setNovoNome] = useState("");
  const [edicao, setEdicao] = useState<{ id: string; nome: string }>();

  // Toda escrita compartilha o ciclo: erro do servidor, recarga da tabela e retorno de sucesso.
  const executar = (
    onde: "tabela" | "servicos",
    acao: () => Promise<ActionResult<void>>,
    aoDarCerto?: () => void,
  ) =>
    iniciar(async () => {
      setErro(undefined);
      try {
        const r = await acao();
        if (!r.ok) return setErro({ onde, mensagem: r.error.message });
        aoDarCerto?.();
        router.refresh();
      } catch {
        setErro({ onde, mensagem: "Falha inesperada. Tente novamente." });
      }
    });

  return (
    <>
      <TabelaDeAcompanhamento
        rotuloCompetencia={rotuloCompetencia}
        anteriorHref={anteriorHref}
        proximoHref={proximoHref}
        servicos={servicos}
        linhas={linhas}
        podeAlterar={podeMarcar}
        pendente={pendente}
        erro={erro?.onde === "tabela" ? erro.mensagem : undefined}
        onMarcar={(clienteId, servicoId, concluido) =>
          executar("tabela", () => marcarServicoAction({ clienteId, servicoId, competencia, concluido }))
        }
        onAplicar={(clienteId, servicoId, aplica) =>
          executar("tabela", () => definirServicoAplicavelAction({ clienteId, servicoId, aplica }))
        }
      />
      {podeGerirServicos && (
        <ServicosDoAcompanhamento
          servicos={servicos}
          novoNome={novoNome}
          onNovoNome={setNovoNome}
          pendente={pendente}
          onCriar={() =>
            executar(
              "servicos",
              () => criarServicoAction({ nome: novoNome }),
              () => setNovoNome(""),
            )
          }
          edicao={edicao}
          onEditar={(servicoId, nome) => setEdicao({ id: servicoId, nome })}
          onNomeEdicao={(nome) => edicao && setEdicao({ id: edicao.id, nome })}
          onCancelarEdicao={() => setEdicao(undefined)}
          onSalvarEdicao={() =>
            edicao &&
            executar(
              "servicos",
              () => renomearServicoAction({ servicoId: edicao.id, nome: edicao.nome }),
              () => setEdicao(undefined),
            )
          }
          erro={erro?.onde === "servicos" ? erro.mensagem : undefined}
          desativando={desativando}
          onDesativar={setDesativando}
          onCancelarDesativar={() => setDesativando(undefined)}
          onConfirmarDesativar={(servicoId) =>
            executar(
              "servicos",
              () => desativarServicoAction({ servicoId }),
              () => setDesativando(undefined),
            )
          }
        />
      )}
    </>
  );
}
