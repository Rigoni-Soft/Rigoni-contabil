"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AjustesDoClienteNaConvencao } from "@/presentation/components/organisms/ajustes-do-cliente-na-convencao.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import type { ConvencoesDoClienteDto } from "@/modules/rh/application/dtos/convencao.dto";
import type { ActionResult } from "@/shared/dtos/action-result.dto";

import { definirConvencaoDoEmpregadoAction, definirInterruptoresAction } from "./convencao.actions";
import { empregadosDosAjustes, sindicatosDoCliente } from "./convencao.presenter";

type Props = { dados: ConvencoesDoClienteDto };

// Interruptores do Cliente e sindicato de cada empregado: cada mudança grava na hora e recarrega a tela.
export function AjustesDoClienteNaConvencaoContainer({ dados }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string>();

  const executar = (acao: () => Promise<ActionResult<void>>) =>
    iniciar(async () => {
      setErro(undefined);
      try {
        const resultado = await acao();
        if (!resultado.ok) return setErro(resultado.error.message);
        router.refresh();
      } catch (e) {
        console.error("Falha ao gravar os ajustes do cliente", e);
        setErro(mensagemDaFalha(e));
      }
    });

  const { interruptores } = dados;
  return (
    <AjustesDoClienteNaConvencao
      bancoDeHoras={interruptores.bancoDeHoras}
      trabalhoAosDomingos={interruptores.trabalhoAosDomingos}
      sindicatos={sindicatosDoCliente(dados.convencoes)}
      empregados={empregadosDosAjustes(dados)}
      editavel={dados.podeEditar}
      pendente={pendente}
      erro={erro}
      onBancoDeHoras={(ligado) =>
        executar(() =>
          definirInterruptoresAction({
            clienteId: dados.clienteId,
            ...interruptores,
            bancoDeHoras: ligado,
          }),
        )
      }
      onTrabalhoAosDomingos={(ligado) =>
        executar(() =>
          definirInterruptoresAction({
            clienteId: dados.clienteId,
            ...interruptores,
            trabalhoAosDomingos: ligado,
          }),
        )
      }
      onSindicato={(empregadoId, sindicato) =>
        executar(() =>
          definirConvencaoDoEmpregadoAction({ empregadoId, sindicato: sindicato || null }),
        )
      }
    />
  );
}
