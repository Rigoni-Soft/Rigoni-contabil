export type DocumentoVisivel = {
  tipo: "contrato" | "alteracao";
  numero: number | null;
  data: string | null;
};

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Botão: há alteração = "Visualizar alteração"; só o contrato social = "Visualizar contrato social".
export function rotuloDoBotao(documentos: DocumentoVisivel[]): string {
  return documentos.some((d) => d.tipo === "alteracao")
    ? "Visualizar alteração"
    : "Visualizar contrato social";
}

export function rotuloDoDocumento(documento: DocumentoVisivel): string {
  if (documento.tipo === "contrato") return "Contrato social";
  const base = `Alteração nº ${documento.numero}`;
  return documento.data ? `${base} - ${formatarData(documento.data)}` : base;
}

export function chaveDoDocumento(documento: DocumentoVisivel): string {
  return documento.tipo === "contrato" ? "contrato" : `alteracao-${documento.numero}`;
}
