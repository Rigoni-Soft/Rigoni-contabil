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
