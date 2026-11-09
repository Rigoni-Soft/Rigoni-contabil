"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  AcompanhamentoDoClienteRh,
  type EstadoDoServico,
  type Servico,
} from "@/presentation/components/organisms/acompanhamento-do-cliente-rh.component";
import type { ActionResult } from "@/shared/dtos/action-result.dto";

import {
  definirServicoAplicavelAction,
  marcarServicoAction,
} from "./acompanhamento-mensal.actions";
import { mensagemDaFalha, passosDaTroca } from "./acompanhamento-mensal.presenter";

type Props = {
  clienteId: string;
  competencia: string;
  rotuloCompetencia: string;
  anteriorHref: string;
  proximoHref?: string;
  servicos: Servico[];
};

export function AcompanhamentoDoClienteContainer({
  clienteId,
  competencia,
  servicos,
  ...mes
}: Props) {
  const router = useRouter();
  // A escolha aparece na hora e volta ao valor do servidor se a gravação falhar.
  const [exibidos, escolher] = useOptimistic(
    servicos,
    (atual, t: { servicoId: string; para: EstadoDoServico }) =>
      atual.map((s) => (s.servicoId === t.servicoId ? { ...s, estado: t.para } : s)),
  );
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string>();

  const trocar = async (
    servicoId: string,
    de: EstadoDoServico,
    para: EstadoDoServico,
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
    <AcompanhamentoDoClienteRh
      {...mes}
      servicos={exibidos}
      pendente={pendente}
      erro={erro}
      onTrocar={(servicoId, de, para) =>
        iniciar(async () => {
          setErro(undefined);
          escolher({ servicoId, para });
          try {
            const r = await trocar(servicoId, de, para);
            if (!r.ok) setErro(r.error.message);
          } catch (erro) {
            console.error("Falha ao marcar o serviço do acompanhamento", erro);
            setErro(mensagemDaFalha(erro));
          }
          // Uma troca em dois passos pode ter gravado o primeiro: a tela relê o que ficou.
          router.refresh();
        })
      }
    />
  );
}
