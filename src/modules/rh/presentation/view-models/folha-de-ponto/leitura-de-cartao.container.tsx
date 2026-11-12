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
// Qual campo mostra o erro (a foto ou o atestado escolhido); sem campo, o erro é da leitura.
type Falha = { mensagem: string; campo?: "foto" | "atestado" };

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

// Mensagem de uma foto que não serve (tipo ou tamanho), ou undefined se serve.
function recusaDaFoto(foto: File | undefined, semFoto: string): string | undefined {
  if (!foto || (foto.type !== "image/jpeg" && foto.type !== "image/png")) return semFoto;
  return foto.size > LIMITE_DA_FOTO ? MENSAGEM_FOTO_GRANDE : undefined;
}

// Sobe a foto de uma quinzena (e, à parte, um atestado) e recarrega a tela com o empregado e o cartão. Só o
// sucesso limpa a foto; a falha da leitura preserva a escolha e manda digitar ou abonar à mão.
export function LeituraDeCartaoContainer({ clienteId, competencia }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [lendo, setLendo] = useState<"cartao" | "atestado">();
  const [arquivo, setArquivo] = useState<File>();
  const [atestado, setAtestado] = useState<File>();
  const [falha, setFalha] = useState<Falha>();
  const [resultado, setResultado] = useState<string>();

  // O erro de uma foto escolhida leva o foco ao próprio campo (o botão clicado não some, mas o erro está lá).
  const recusar = (mensagem: string, campo: Falha["campo"]) => {
    setFalha({ mensagem, campo });
    document.getElementById(campo === "atestado" ? "leitura-atestado" : "leitura-foto")?.focus();
  };

  const enviar = (qual: "cartao" | "atestado", formData: FormData) => {
    setFalha(undefined);
    setLendo(qual);
    iniciar(async () => {
      try {
        const r =
          qual === "cartao"
            ? await lerCartaoDePontoAction(formData)
            : await lerAtestadoDePontoAction(formData);
        if (!r.ok) return setFalha({ mensagem: r.error.message });
        if (qual === "cartao") {
          setArquivo(undefined);
          setResultado(resumoDaLeitura(r.data as CartaoLidoDto));
        } else {
          setAtestado(undefined);
          setResultado(resumoDoAtestado(r.data as AtestadoLidoDto));
        }
        router.refresh();
      } catch (e) {
        console.error("Falha ao ler a foto", e);
        setFalha({ mensagem: mensagemDaFalha(e) });
      } finally {
        setLendo(undefined);
      }
    });
  };

  return (
    <LeituraDeCartao
      rotuloMes={rotuloDaCompetencia(competencia)}
      arquivo={arquivo}
      atestado={atestado}
      pendente={pendente}
      lendoAtestado={lendo === "atestado"}
      erro={falha?.mensagem}
      erroNoCampo={falha?.campo === "foto"}
      erroNoAtestado={falha?.campo === "atestado"}
      resultado={resultado}
      onArquivo={(a) => {
        setArquivo(a);
        setFalha(undefined);
        setResultado(undefined);
      }}
      onAtestado={(a) => {
        setAtestado(a);
        setFalha(undefined);
        setResultado(undefined);
      }}
      onLerAtestado={() => {
        if (pendente) return;
        setResultado(undefined);
        const recusa = recusaDaFoto(atestado, MENSAGEM_SEM_ATESTADO);
        if (recusa || !atestado) return recusar(recusa ?? MENSAGEM_SEM_ATESTADO, "atestado");
        const formData = new FormData();
        formData.set("clienteId", clienteId);
        formData.set("imagem", atestado);
        enviar("atestado", formData);
      }}
      onLer={(campos) => {
        if (pendente) return;
        setResultado(undefined);
        const recusa = recusaDaFoto(arquivo, MENSAGEM_SEM_FOTO);
        if (recusa || !arquivo) return recusar(recusa ?? MENSAGEM_SEM_FOTO, "foto");
        const formData = new FormData();
        formData.set("clienteId", clienteId);
        formData.set("competencia", competencia);
        formData.set("quinzena", String(campos.get("quinzena") ?? "1"));
        formData.set("imagem", arquivo);
        enviar("cartao", formData);
      }}
    />
  );
}
