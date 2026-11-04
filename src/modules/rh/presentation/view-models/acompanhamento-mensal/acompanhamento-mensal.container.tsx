"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ServicosDoAcompanhamento } from "@/presentation/components/organisms/servicos-do-acompanhamento.component";
import {
  type EstadoDaCelula,
  TabelaDeAcompanhamento,
} from "@/presentation/components/organisms/tabela-de-acompanhamento.component";
import type { ActionResult } from "@/shared/dtos/action-result.dto";

import {
  criarServicoAction,
  definirServicoAplicavelAction,
  desativarServicoAction,
  marcarServicoAction,
  renomearServicoAction,
} from "./acompanhamento-mensal.actions";
import { type LinhaDaTabela, passosDaTroca } from "./acompanhamento-mensal.presenter";

type Props = {
  competencia: string;
  rotuloCompetencia: string;
  anteriorHref: string;
  proximoHref?: string;
  servicos: { id: string; nome: string; sistema: boolean }[];
  linhas: LinhaDaTabela[];
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
  podeGerirServicos,
}: Props) {
  const router = useRouter();
  // A escolha aparece na hora e volta ao valor do servidor se a gravação falhar.
  const [linhasExibidas, escolher] = useOptimistic(
    linhas,
    (atual, t: { clienteId: string; servicoId: string; para: EstadoDaCelula }) =>
      atual.map((l) =>
        l.clienteId !== t.clienteId
          ? l
          : {
              ...l,
              celulas: l.celulas.map((c) =>
                c.servicoId === t.servicoId ? { ...c, estado: t.para } : c,
              ),
            },
      ),
  );
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
        if (!r.ok) {
          setErro({ onde, mensagem: r.error.message });
          // Uma troca em dois passos pode ter gravado o primeiro: a tela relê o que ficou.
          return router.refresh();
        }
        aoDarCerto?.();
        router.refresh();
      } catch {
        setErro({ onde, mensagem: "Falha inesperada. Tente novamente." });
      }
    });

  const trocarEstado = async (
    clienteId: string,
    servicoId: string,
    de: EstadoDaCelula,
    para: EstadoDaCelula,
  ): Promise<ActionResult<void>> => {
    for (const passo of passosDaTroca(de, para)) {
      const r =
        passo.tipo === "marcar"
          ? await marcarServicoAction({ clienteId, servicoId, competencia, concluido: passo.valor })
          : await definirServicoAplicavelAction({ clienteId, servicoId, aplica: passo.valor });
      if (!r.ok) return r;
    }
    return { ok: true, data: undefined };
  };

  return (
    <>
      <TabelaDeAcompanhamento
        rotuloCompetencia={rotuloCompetencia}
        anteriorHref={anteriorHref}
        proximoHref={proximoHref}
        servicos={servicos}
        linhas={linhasExibidas}
        pendente={pendente}
        erro={erro?.onde === "tabela" ? erro.mensagem : undefined}
        onTrocar={(clienteId, servicoId, de, para) =>
          executar("tabela", () => {
            escolher({ clienteId, servicoId, para });
            return trocarEstado(clienteId, servicoId, de, para);
          })
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
