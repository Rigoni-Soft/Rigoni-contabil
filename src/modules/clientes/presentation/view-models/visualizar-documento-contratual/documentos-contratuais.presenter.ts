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

export function paraOpcao(documento: DocumentoContratualVisivelDto) {
  return { valor: chaveDoDocumento(documento), rotulo: rotuloDoDocumento(documento) };
}

export function chaveDoDocumento(documento: DocumentoContratualVisivelDto): string {
  return documento.tipo === "contrato" ? "contrato" : `alteracao-${documento.numero}`;
}
