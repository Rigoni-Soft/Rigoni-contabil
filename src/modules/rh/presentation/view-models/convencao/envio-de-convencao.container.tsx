"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { EnvioDeConvencao } from "@/presentation/components/organisms/envio-de-convencao.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";

import { enviarConvencaoAction } from "./convencao.actions";
import { lerEnvioDoFormulario } from "./convencao.presenter";

type Props = { clienteId: string };

// Sobe a convenção: confere o que o navegador alcança, envia o PDF e recarrega a tela com o histórico e as
// regras novas. Só o sucesso limpa o formulário; a recusa preserva o que foi digitado.
export function EnvioDeConvencaoContainer({ clienteId }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [arquivo, setArquivo] = useState<File>();
  const [erro, setErro] = useState<string>();
  const [chave, setChave] = useState(0);

  return (
    <EnvioDeConvencao
      arquivo={arquivo}
      chave={chave}
      pendente={pendente}
      erro={erro}
      onArquivo={(a) => {
        setArquivo(a);
        setErro(undefined);
      }}
      onEnviar={(campos) => {
        const lido = lerEnvioDoFormulario(clienteId, campos, arquivo);
        if (!lido.ok) return setErro(lido.erro);
        setErro(undefined);
        iniciar(async () => {
          try {
            const r = await enviarConvencaoAction(lido.formData);
            if (!r.ok) return setErro(r.error.message);
            setArquivo(undefined);
            setChave((c) => c + 1);
            router.refresh();
          } catch (e) {
            console.error("Falha ao enviar a convenção", e);
            setErro(mensagemDaFalha(e));
          }
        });
      }}
    />
  );
}
