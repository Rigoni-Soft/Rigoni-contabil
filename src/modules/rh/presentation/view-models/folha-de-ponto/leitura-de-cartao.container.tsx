"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LeituraDeCartao } from "@/presentation/components/organisms/leitura-de-cartao.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import type { AtestadoLidoDto } from "@/modules/rh/application/ports/in/ler-atestado-de-ponto.provider";
import type { CartaoLidoDto } from "@/modules/rh/application/ports/in/ler-cartao-de-ponto.provider";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";

import { lerAtestadoDePontoAction, lerCartaoDePontoAction } from "./folha-de-ponto.actions";
import { LIMITE_DA_FOTO, MENSAGEM_FOTO_GRANDE, MENSAGEM_SEM_FOTO } from "./folha-de-ponto.schema";

const MENSAGEM_SEM_ATESTADO = "Escolha a foto do atestado (JPEG ou PNG).";

type Props = { clienteId: string; competencia: string };

export function resumoDaLeitura(c: CartaoLidoDto): string {
  const partes = [`${c.dias} ${c.dias === 1 ? "dia lido" : "dias lidos"}`];
  if (c.faltas > 0)
    partes.push(`${c.faltas} ${c.faltas === 1 ? "falta anotada" : "faltas anotadas"}`);
  if (c.abonos > 0) partes.push(`${c.abonos} ${c.abonos === 1 ? "abono" : "abonos"}`);
  const novo = c.cadastrado ? " (cadastrado no quadro)" : "";
  return `${c.nome}${novo}: ${partes.join(", ")}. Confira o cartão.`;
}

export function resumoDoAtestado(a: AtestadoLidoDto): string {
  return a.abonados > 0
    ? `${a.nome}: ${a.abonados} ${a.abonados === 1 ? "dia abonado" : "dias abonados"}. Confira o cartão.`
    : `${a.nome}: nenhum dia abonado (a declaração só abona o horário de um dia com batida). Abone à mão se precisar.`;
}

// Sobe a foto de uma quinzena e recarrega a tela com o empregado e o cartão. Só o sucesso limpa a foto; a
// falha da leitura preserva a escolha e manda digitar à mão.
export function LeituraDeCartaoContainer({ clienteId, competencia }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [arquivo, setArquivo] = useState<File>();
  const [atestado, setAtestado] = useState<File>();
  const [erroNoAtestado, setErroNoAtestado] = useState(false);
  const [erro, setErro] = useState<string>();
  const [erroNoCampo, setErroNoCampo] = useState(false);
  const [resultado, setResultado] = useState<string>();

  const falhaDoCampo = (mensagem: string) => {
    setErroNoCampo(true);
    setErro(mensagem);
  };

  const lerAtestado = () => {
    if (pendente) return;
    setResultado(undefined);
    const invalido =
      !atestado || (atestado.type !== "image/jpeg" && atestado.type !== "image/png")
        ? MENSAGEM_SEM_ATESTADO
        : atestado.size > LIMITE_DA_FOTO
          ? MENSAGEM_FOTO_GRANDE
          : undefined;
    if (invalido || !atestado) {
      setErroNoCampo(false);
      setErroNoAtestado(true);
      return setErro(invalido);
    }
    setErro(undefined);
    setErroNoAtestado(false);
    const formData = new FormData();
    formData.set("clienteId", clienteId);
    formData.set("imagem", atestado);
    iniciar(async () => {
      try {
        const r = await lerAtestadoDePontoAction(formData);
        if (!r.ok) {
          setErroNoAtestado(false);
          return setErro(r.error.message);
        }
        setAtestado(undefined);
        setResultado(resumoDoAtestado(r.data));
        router.refresh();
      } catch (e) {
        console.error("Falha ao ler o atestado", e);
        setErro(mensagemDaFalha(e));
      }
    });
  };

  return (
    <LeituraDeCartao
      rotuloMes={rotuloDaCompetencia(competencia)}
      arquivo={arquivo}
      atestado={atestado}
      pendente={pendente}
      erro={erro}
      erroNoCampo={erroNoCampo}
      erroNoAtestado={erroNoAtestado}
      onAtestado={(a) => {
        setAtestado(a);
        setErro(undefined);
        setErroNoAtestado(false);
        setResultado(undefined);
      }}
      onLerAtestado={lerAtestado}
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
            const r = await lerCartaoDePontoAction(formData);
            if (!r.ok) {
              setErroNoCampo(false);
              return setErro(r.error.message);
            }
            setArquivo(undefined);
            setResultado(resumoDaLeitura(r.data));
            router.refresh();
          } catch (e) {
            console.error("Falha ao ler a foto do cartão", e);
            setErro(mensagemDaFalha(e));
          }
        });
      }}
    />
  );
}
