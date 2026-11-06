// Caracteres como o WhatsApp conta: por ponto de código, não por unidade UTF-16 (um emoji vale 1).
export function contarCaracteres(texto: string): number {
  return [...texto].length;
}

// Limite do emoji de uma reação, em unidades UTF-16 (cobre ZWJ, bandeira e tom de pele).
export const EMOJI_TAMANHO_MAXIMO = 16;

// Pictograma, bandeira ou keycap, mais os caracteres que os compõem (ZWJ, seletor de variação,
// tom de pele, dígito e #/* do keycap).
const EMOJI = /^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}‍️⃣#*0-9]+$/u;
const TEM_PICTOGRAMA = /[\p{Extended_Pictographic}\p{Regional_Indicator}⃣]/u;

// Um emoji (ou sequência): até o limite e com pictograma. Não é uma lista fechada: a UI oferece a
// lista, aqui só se impede que texto comum vire reação no provedor.
export function emojiValido(texto: string): boolean {
  return (
    texto.length > 0 &&
    texto.length <= EMOJI_TAMANHO_MAXIMO &&
    EMOJI.test(texto) &&
    TEM_PICTOGRAMA.test(texto)
  );
}
