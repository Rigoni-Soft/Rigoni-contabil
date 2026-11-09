"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ServicosDoAcompanhamento } from "@/presentation/components/organisms/servicos-do-acompanhamento.component";
import type { ActionResult } from "@/shared/dtos/action-result.dto";

import {
  criarServicoAction,
  desativarServicoAction,
  renomearServicoAction,
} from "./acompanhamento-mensal.actions";
import { mensagemDaFalha } from "./acompanhamento-mensal.presenter";

type Props = { servicos: { id: string; nome: string; sistema: boolean }[] };

// A lista dos serviços do acompanhamento, mantida pelo Líder do RH: cada serviço vira um card no dashboard.
export function ServicosDoAcompanhamentoContainer({ servicos }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string>();
  const [desativando, setDesativando] = useState<string>();
  const [novoNome, setNovoNome] = useState("");
  const [edicao, setEdicao] = useState<{ id: string; nome: string }>();

  // Toda escrita compartilha o ciclo: erro do servidor, recarga da lista e retorno de sucesso.
  const executar = (acao: () => Promise<ActionResult<void>>, aoDarCerto: () => void) =>
    iniciar(async () => {
      setErro(undefined);
      try {
        const r = await acao();
        if (!r.ok) return setErro(r.error.message);
        aoDarCerto();
        router.refresh();
      } catch (erro) {
        console.error("Falha ao gravar os serviços do acompanhamento", erro);
        setErro(mensagemDaFalha(erro));
      }
    });

  return (
    <ServicosDoAcompanhamento
      servicos={servicos}
      novoNome={novoNome}
      onNovoNome={setNovoNome}
      pendente={pendente}
      onCriar={() =>
        executar(
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
          () => renomearServicoAction({ servicoId: edicao.id, nome: edicao.nome }),
          () => setEdicao(undefined),
        )
      }
      erro={erro}
      desativando={desativando}
      onDesativar={setDesativando}
      onCancelarDesativar={() => setDesativando(undefined)}
      onConfirmarDesativar={(servicoId) =>
        executar(
          () => desativarServicoAction({ servicoId }),
          () => setDesativando(undefined),
        )
      }
    />
  );
}
