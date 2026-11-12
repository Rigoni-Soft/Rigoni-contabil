"use client";

import { useId, useState, useTransition } from "react";

import { LeituraDeAtestado } from "@/presentation/components/organisms/leitura-de-atestado.component";
import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import type { AtestadoLidoDto } from "@/modules/rh/application/ports/in/ler-atestado-de-ponto.provider";

import { lerAtestadoDePontoAction } from "./folha-de-ponto.actions";
import { LIMITE_DA_FOTO, MENSAGEM_FOTO_GRANDE } from "./folha-de-ponto.schema";

const MENSAGEM_SEM_ATESTADO = "Escolha a foto do atestado (JPEG ou PNG).";

type Props = {
  empregadoId: string;
  nomeDoEmpregado: string;
  // Sucesso: o Container do cartão atualiza a planilha e mostra este resumo.
  aoAbonar: (resumo: string) => void;
};

export function resumoDoAtestado(a: AtestadoLidoDto): string {
  const dias = `${a.abonados} ${a.abonados === 1 ? "dia abonado" : "dias abonados"}`;
  return `${dias} ${a.tipo === "atestado" ? "pelo atestado" : "pela declaração de comparecimento"}. Confira o cartão.`;
}

// Mensagem da foto escolhida que não serve (falta, tipo ou tamanho), ou undefined se serve.
function recusaDaFoto(foto?: File): string | undefined {
  if (!foto || (foto.type !== "image/jpeg" && foto.type !== "image/png")) {
    return MENSAGEM_SEM_ATESTADO;
  }
  return foto.size > LIMITE_DA_FOTO ? MENSAGEM_FOTO_GRANDE : undefined;
}

// Abre a modal, lê o atestado e, se abonou, fecha a modal e avisa o cartão. Falha mantém a modal aberta com o
// motivo e o cartão como estava; a foto escolhida fica para o usuário trocar.
export function LeituraDeAtestadoContainer({ empregadoId, nomeDoEmpregado, aoAbonar }: Props) {
  const painelId = `leitura-atestado-${useId().replace(/:/g, "")}`;
  const [pendente, iniciar] = useTransition();
  const [arquivo, setArquivo] = useState<File>();
  const [erro, setErro] = useState<string>();
  const [erroNoCampo, setErroNoCampo] = useState(false);

  const modal = () => document.getElementById(painelId) as HTMLDialogElement | null;

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
        setArquivo(undefined);
        const aberto = modal();
        if (aberto && !aberto.open) aberto.showModal();
      }}
      aoFechar={() => modal()?.close()}
      onArquivo={(a) => {
        setArquivo(a);
        setErro(undefined);
      }}
      onLer={() => {
        if (pendente) return;
        const recusa = recusaDaFoto(arquivo);
        if (recusa || !arquivo) {
          setErroNoCampo(true);
          setErro(recusa ?? MENSAGEM_SEM_ATESTADO);
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
            const r = await lerAtestadoDePontoAction(formData);
            if (!r.ok) {
              setErroNoCampo(false);
              return setErro(r.error.message);
            }
            setArquivo(undefined);
            modal()?.close();
            aoAbonar(resumoDoAtestado(r.data));
          } catch (e) {
            console.error("Falha ao ler o atestado", e);
            setErroNoCampo(false);
            setErro(mensagemDaFalha(e));
          }
        });
      }}
    />
  );
}
