"use client";

import { PainelDePrevia } from "@/presentation/components/atoms/painel-de-previa.component";
import { usePreviaDeOffice } from "@/modules/atendimento/presentation/view-models/conversa/use-previa-de-office.hook";

type PreviaDeOfficeContainerProps = {
  nome: string;
  // Endereço do arquivo para o navegador ler (sem cabeçalho de download).
  url: string;
  formato: "docx" | "xlsx";
  painelId: string;
};

export function PreviaDeOfficeContainer({
  nome,
  url,
  formato,
  painelId,
}: PreviaDeOfficeContainerProps) {
  const { estado, previa, abrir } = usePreviaDeOffice(url, formato);
  return (
    <PainelDePrevia
      nome={nome}
      painelId={`${painelId}-previa`}
      estado={estado}
      previa={previa}
      aoAbrir={() => void abrir()}
    />
  );
}
