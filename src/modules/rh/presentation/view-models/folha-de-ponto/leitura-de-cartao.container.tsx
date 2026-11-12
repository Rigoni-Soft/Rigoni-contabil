"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LeituraDeCartao } from "@/presentation/components/organisms/leitura-de-cartao.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import type { CartaoLidoDto } from "@/modules/rh/application/ports/in/ler-cartao-de-ponto.provider";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";

import { lerCartaoDePontoAction } from "./folha-de-ponto.actions";
import { LIMITE_DA_FOTO, MENSAGEM_FOTO_GRANDE, MENSAGEM_SEM_FOTO } from "./folha-de-ponto.schema";

type Props = { clienteId: string; competencia: string };

function resumoDaLeitura(cartao: CartaoLidoDto): string {
  const partes = [`${cartao.dias} ${cartao.dias === 1 ? "dia lido" : "dias lidos"}`];
  if (cartao.faltas > 0)
    partes.push(`${cartao.faltas} ${cartao.faltas === 1 ? "falta anotada" : "faltas anotadas"}`);
  if (cartao.abonos > 0)
    partes.push(`${cartao.abonos} ${cartao.abonos === 1 ? "abono" : "abonos"}`);
  const novo = cartao.cadastrado ? " (cadastrado no quadro)" : "";
  return `${cartao.nome}${novo}: ${partes.join(", ")}. Confira o cartão.`;
}

// Sobe a foto de uma quinzena e recarrega a tela com o empregado e o cartão. Só o sucesso limpa a foto; a
// falha da leitura preserva a escolha e manda digitar à mão.
export function LeituraDeCartaoContainer({ clienteId, competencia }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [arquivo, setArquivo] = useState<File>();
  const [erro, setErro] = useState<string>();
  const [erroNoCampo, setErroNoCampo] = useState(false);
  const [resultado, setResultado] = useState<string>();

  const falhaDoCampo = (mensagem: string) => {
    setErroNoCampo(true);
    setErro(mensagem);
  };

  return (
    <LeituraDeCartao
      rotuloMes={rotuloDaCompetencia(competencia)}
      arquivo={arquivo}
      pendente={pendente}
      erro={erro}
      erroNoCampo={erroNoCampo}
      resultado={resultado}
      onArquivo={(a) => {
        setArquivo(a);
        setErro(undefined);
        setResultado(undefined);
      }}
      onLer={(campos) => {
        if (pendente) return;
        setResultado(undefined);
        if (!arquivo || (arquivo.type !== "image/jpeg" && arquivo.type !== "image/png")) {
          return falhaDoCampo(MENSAGEM_SEM_FOTO);
        }
        if (arquivo.size > LIMITE_DA_FOTO) return falhaDoCampo(MENSAGEM_FOTO_GRANDE);
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
      }}
    />
  );
}
