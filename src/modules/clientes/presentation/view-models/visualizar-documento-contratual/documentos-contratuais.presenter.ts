import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import { formatarDataIso } from "@/shared/kernel/data-iso";

// Botão: há alteração = "Visualizar alteração"; só o contrato social = "Visualizar contrato social".
export function rotuloDoBotao(documentos: DocumentoContratualVisivelDto[]): string {
  return documentos.some((d) => d.tipo === "alteracao")
    ? "Visualizar alteração"
    : "Visualizar contrato social";
}

export function rotuloDoDocumento(documento: DocumentoContratualVisivelDto): string {
  if (documento.tipo === "contrato") return "Contrato social";
  const base = `Alteração nº ${documento.numero}`;
  return documento.data ? `${base} - ${formatarDataIso(documento.data)}` : base;
}

// Em destaque: a alteração de maior nº (o contrato social só quando não há alteração), sem depender
// da ordem em que a lista chegou.
export function documentoEmDestaque(
  documentos: DocumentoContratualVisivelDto[],
): DocumentoContratualVisivelDto {
  const alteracoes = documentos.filter((d) => d.tipo === "alteracao");
  if (alteracoes.length === 0) return documentos[0];
  return alteracoes.reduce((maior, d) => ((d.numero ?? 0) > (maior.numero ?? 0) ? d : maior));
}

export function paraOpcao(documento: DocumentoContratualVisivelDto) {
  return { valor: chaveDoDocumento(documento), rotulo: rotuloDoDocumento(documento) };
}

export function chaveDoDocumento(documento: DocumentoContratualVisivelDto): string {
  return documento.tipo === "contrato" ? "contrato" : `alteracao-${documento.numero}`;
}
