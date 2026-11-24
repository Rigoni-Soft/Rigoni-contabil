export function hrefSeguro(valor: string | undefined, padrao = "/"): string {
  if (valor && valor.startsWith("/") && !valor.startsWith("//") && !valor.includes("://")) {
    return valor;
  }
  return padrao;
}
