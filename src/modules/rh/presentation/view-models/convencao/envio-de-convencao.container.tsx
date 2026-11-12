"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { EnvioDeConvencao } from "@/presentation/components/organisms/envio-de-convencao.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";

import { enviarConvencaoAction } from "./convencao.actions";
import { lerEnvioDoFormulario } from "./convencao.presenter";

const ID_DO_ARQUIVO = "convencao-arquivo";

type Props = { clienteId: string };

// Sobe a convenção: confere o que o navegador alcança, envia o PDF e recarrega a tela com o histórico e as
// regras novas. Só o sucesso limpa o formulário; a recusa preserva o que foi digitado.
export function EnvioDeConvencaoContainer({ clienteId }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [arquivo, setArquivo] = useState<File>();
  const [erro, setErro] = useState<string>();
  const [chave, setChave] = useState(0);

  // O erro é do campo do PDF: o foco vai a ele, para o teclado e o leitor de tela ouvirem a mensagem.
  useEffect(() => {
    if (erro) document.getElementById(ID_DO_ARQUIVO)?.focus();
  }, [erro]);

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
      onEnviar={() => {
        const lido = lerEnvioDoFormulario(clienteId, arquivo);
        if (!lido.ok) return setErro(lido.erro);
        setErro(undefined);
        iniciar(async () => {
          try {
            const resultado = await enviarConvencaoAction(lido.formData);
            if (!resultado.ok) return setErro(resultado.error.message);
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
