"use client";

import { PainelDePrevia } from "@/presentation/components/atoms/painel-de-previa.component";
import { usePreviaDeOffice } from "@/modules/atendimento/presentation/view-models/conversa/use-previa-de-office.hook";
import type { FormatoDeOffice } from "@/shared/kernel/anexo";

type PreviaDeOfficeContainerProps = {
  nome: string;
  url: string;
  formato: FormatoDeOffice;
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
