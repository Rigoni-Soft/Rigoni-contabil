export const TEXTO_CURTO_MAXIMO = 120;

export const NOME_DO_ARQUIVO_MAXIMO = 255;

export function contarCaracteres(texto: string): number {
  return [...texto].length;
}

const EMOJI_TAMANHO_MAXIMO = 16;

const JUNTOR_DE_EMOJI = "\\u200D";
const SELETOR_DE_VARIACAO_EMOJI = "\\uFE0F";
const KEYCAP = "\\u20E3";

const EMOJI = new RegExp(
  `^[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\p{Emoji_Modifier}${JUNTOR_DE_EMOJI}${SELETOR_DE_VARIACAO_EMOJI}${KEYCAP}#*0-9]+$`,
  "u",
);
const TEM_PICTOGRAMA = new RegExp(
  `[\\p{Extended_Pictographic}\\p{Regional_Indicator}${KEYCAP}]`,
  "u",
);

export function emojiValido(texto: string): boolean {
  return (
    texto.length > 0 &&
    texto.length <= EMOJI_TAMANHO_MAXIMO &&
    EMOJI.test(texto) &&
    TEM_PICTOGRAMA.test(texto)
  );
}
