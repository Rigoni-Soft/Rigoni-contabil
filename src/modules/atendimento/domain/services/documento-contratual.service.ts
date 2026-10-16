function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Como o documento é chamado ao cliente (menu da URA, nome do arquivo e Mensagem do painel).
export function descreverDocumento(documento: { data: string | null }): string {
  return documento.data ? `Alteração de ${formatarData(documento.data)}` : "Contrato social";
}
