function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Como o documento é chamado ao cliente (menu da URA, nome do arquivo e Mensagem do painel).
export function descreverDocumento(documento: {
  numero: number | null;
  data: string | null;
}): string {
  return documento.data
    ? `Alteração nº ${documento.numero} - ${formatarData(documento.data)}`
    : "Contrato social";
}

// Ordem de exibição: o contrato social (sem nº) primeiro, depois as alterações por nº decrescente.
export function porNumeroDecrescente(x: { numero: number | null }, y: { numero: number | null }) {
  if (x.numero === null) return y.numero === null ? 0 : -1;
  if (y.numero === null) return 1;
  return y.numero - x.numero;
}
