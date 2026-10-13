// Caracteres como o WhatsApp conta: por ponto de código, não por unidade UTF-16 (um emoji vale 1).
export function contarCaracteres(texto: string): number {
  return [...texto].length;
}
