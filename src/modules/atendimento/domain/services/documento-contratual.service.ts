import { formatarDataIso } from "@/shared/kernel/data-iso";

export const ROTULO_GUIA = {
  das: "Guia de imposto",
  parcelamento: "Guia de parcelamento",
  cnd: "CND",
} as const;

export function descreverDocumento(documento: {
  numero: number | null;
  data: string | null;
}): string {
  if (documento.numero === null) return "Contrato social";
  return documento.data
    ? `Alteração nº ${documento.numero} - ${formatarDataIso(documento.data)}`
    : `Alteração nº ${documento.numero}`;
}
