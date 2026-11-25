const ehCaminhoRelativoDoSite = (valor: string) =>
  valor.startsWith("/") && !valor.startsWith("//") && !valor.includes("://");

export function hrefSeguro(valor: string | undefined, padrao = "/"): string {
  return valor && ehCaminhoRelativoDoSite(valor) ? valor : padrao;
}
