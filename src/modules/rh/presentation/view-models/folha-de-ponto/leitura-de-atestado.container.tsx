"use client";

import { useId, useState, useTransition } from "react";

import { LeituraDeAtestado } from "@/presentation/components/organisms/leitura-de-atestado.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";

import { lerAtestadoDePontoAction } from "./folha-de-ponto.actions";
import { resumoDoAtestado } from "./folha-de-ponto.presenter";
import { fotoDoAtestadoSchema, recusaDaFoto } from "./folha-de-ponto.schema";

type Props = {
  empregadoId: string;
  nomeDoEmpregado: string;
  aoAbonar: (resumo: string) => void;
};

export function LeituraDeAtestadoContainer({ empregadoId, nomeDoEmpregado, aoAbonar }: Props) {
  const painelId = `leitura-atestado-${useId().replace(/:/g, "")}`;
  const [pendente, iniciar] = useTransition();
  const [arquivo, setArquivo] = useState<File>();
  const [erro, setErro] = useState<string>();
  const [erroNoCampo, setErroNoCampo] = useState(false);

  const modal = () => document.getElementById(painelId) as HTMLDialogElement | null;

  const ler = () => {
    if (pendente) return;
    const recusa = recusaDaFoto(fotoDoAtestadoSchema, arquivo);
    if (recusa || !arquivo) {
      setErroNoCampo(true);
      setErro(recusa);
      document.getElementById(`${painelId}-foto`)?.focus();
      return;
    }
    setErro(undefined);
    setErroNoCampo(false);
    const formData = new FormData();
    formData.set("empregadoId", empregadoId);
    formData.set("imagem", arquivo);
    iniciar(async () => {
      try {
        const resposta = await lerAtestadoDePontoAction(formData);
        if (!resposta.ok) {
          setErroNoCampo(false);
          return setErro(resposta.error.message);
        }
        setArquivo(undefined);
        modal()?.close();
        aoAbonar(resumoDoAtestado(resposta.data));
      } catch (falha) {
        console.error("Falha ao ler o atestado", falha);
        setErroNoCampo(false);
        setErro(mensagemDaFalha(falha));
      }
    });
  };

  return (
    <LeituraDeAtestado
      painelId={painelId}
      nomeDoEmpregado={nomeDoEmpregado}
      arquivo={arquivo}
      pendente={pendente}
      erro={erro}
      erroNoCampo={erroNoCampo}
      aoAbrir={() => {
        setErro(undefined);
        setErroNoCampo(false);
        setArquivo(undefined);
        const aberto = modal();
        if (aberto && !aberto.open) aberto.showModal();
      }}
      aoFechar={() => {
        if (!pendente) modal()?.close();
      }}
      onArquivo={(escolhido) => {
        setArquivo(escolhido);
        setErro(undefined);
        setErroNoCampo(false);
      }}
      onLer={ler}
    />
  );
}
