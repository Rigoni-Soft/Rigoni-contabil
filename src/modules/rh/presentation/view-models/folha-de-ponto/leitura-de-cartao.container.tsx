"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LeituraDeCartao } from "@/presentation/components/organisms/leitura-de-cartao.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";

import { lerCartaoDePontoAction } from "./folha-de-ponto.actions";
import { resumoDaLeitura } from "./folha-de-ponto.presenter";
import { fotoDoCartaoSchema, recusaDaFoto } from "./folha-de-ponto.schema";

type Props = { clienteId: string; competencia: string };

// Sobe a foto de uma quinzena e recarrega a tela com o empregado e o cartão. Só o sucesso limpa a foto; a
// falha da leitura preserva a escolha e manda digitar à mão.
export function LeituraDeCartaoContainer({ clienteId, competencia }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [arquivo, setArquivo] = useState<File>();
  const [erro, setErro] = useState<string>();
  const [erroNoCampo, setErroNoCampo] = useState(false);
  const [resultado, setResultado] = useState<string>();

  const ler = (campos: FormData) => {
    if (pendente) return;
    setResultado(undefined);
    const recusa = recusaDaFoto(fotoDoCartaoSchema, arquivo);
    if (recusa || !arquivo) {
      setErroNoCampo(true);
      return setErro(recusa);
    }
    setErro(undefined);
    setErroNoCampo(false);
    const formData = new FormData();
    formData.set("clienteId", clienteId);
    formData.set("competencia", competencia);
    formData.set("quinzena", String(campos.get("quinzena") ?? "1"));
    formData.set("imagem", arquivo);
    iniciar(async () => {
      try {
        const resposta = await lerCartaoDePontoAction(formData);
        if (!resposta.ok) {
          setErroNoCampo(false);
          return setErro(resposta.error.message);
        }
        setArquivo(undefined);
        setResultado(resumoDaLeitura(resposta.data));
        router.refresh();
      } catch (falha) {
        console.error("Falha ao ler a foto do cartão", falha);
        setErro(mensagemDaFalha(falha));
      }
    });
  };

  return (
    <LeituraDeCartao
      rotuloMes={rotuloDaCompetencia(competencia)}
      arquivo={arquivo}
      pendente={pendente}
      erro={erro}
      erroNoCampo={erroNoCampo}
      resultado={resultado}
      onArquivo={(escolhido) => {
        setArquivo(escolhido);
        setErro(undefined);
        setErroNoCampo(false);
        setResultado(undefined);
      }}
      onLer={ler}
    />
  );
}
