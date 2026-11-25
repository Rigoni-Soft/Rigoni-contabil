import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import { formatarDataIso } from "@/shared/kernel/data-iso";

export function rotuloDoDocumento(documento: DocumentoContratualVisivelDto): string {
  if (documento.tipo === "contrato") return "Contrato social";
  const base = `Alteração nº ${documento.numero}`;
  return documento.data ? `${base} - ${formatarDataIso(documento.data)}` : base;
}

export function documentoEmDestaque(
  documentos: DocumentoContratualVisivelDto[],
  alteracaoEmFoco?: number,
): DocumentoContratualVisivelDto {
  const alteracoes = documentos.filter((d) => d.tipo === "alteracao");
  if (alteracoes.length === 0) return documentos[0];
  const apontada = alteracoes.find((d) => d.numero === alteracaoEmFoco);
  if (apontada) return apontada;
  return alteracoes.reduce((maior, d) => ((d.numero ?? 0) > (maior.numero ?? 0) ? d : maior));
}

export function alteracaoEmFocoDaUrl(valor: string | string[] | undefined): number | undefined {
  return typeof valor === "string" && /^[1-9]\d*$/.test(valor) ? Number(valor) : undefined;
}
