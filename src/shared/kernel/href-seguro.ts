// Só aceita caminho relativo do próprio site — nunca repassar o parâmetro de
// query direto pro href (open redirect: "//evil.com", "https://evil.com" etc.).
export function hrefSeguro(valor: string | undefined, padrao = "/"): string {
  if (valor && valor.startsWith("/") && !valor.startsWith("//") && !valor.includes("://")) {
    return valor;
  }
  return padrao;
}
