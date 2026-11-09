"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ObservacoesDoRh } from "@/presentation/components/organisms/observacoes-do-rh.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";

import { editarCadastroRhAction } from "./editar-cadastro-rh.actions";

type Props = { clienteId: string; observacoesIniciais: string };

// O Admin grava só as observações do RH (sem `contatos`, que ficam como estão); o resto do cadastro do RH
// é do formulário do RH.
export function ObservacoesDoRhContainer({ clienteId, observacoesIniciais }: Props) {
  const router = useRouter();
  const [valor, setValor] = useState(observacoesIniciais);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string>();
  const [sucesso, setSucesso] = useState(false);

  const salvar = async () => {
    setPendente(true);
    setErro(undefined);
    setSucesso(false);
    try {
      const r = await editarCadastroRhAction({ clienteId, observacoes: valor });
      if (!r.ok) return setErro(r.error.message);
      setSucesso(true);
      router.refresh();
    } catch (falha) {
      console.error("Falha ao salvar as observações do RH", falha);
      setErro(mensagemDaFalha(falha));
    } finally {
      setPendente(false);
    }
  };

  return (
    <ObservacoesDoRh
      valor={valor}
      onMudar={(novo) => {
        setValor(novo);
        setSucesso(false);
      }}
      onSalvar={() => void salvar()}
      pendente={pendente}
      erro={erro}
      sucesso={sucesso}
    />
  );
}
