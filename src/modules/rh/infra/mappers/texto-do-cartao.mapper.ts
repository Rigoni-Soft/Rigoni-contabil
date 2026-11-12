import type { LeituraDoCartao } from "@/modules/rh/domain/services/leitura-do-cartao.service";

export type LinhaLida = { texto: string; confianca: number };

// Abaixo disso o OCR chuta: o nome ou o horário não é tomado como lido e o leitor seguinte assume.
export const CONFIANCA_MINIMA = 80;

const HORARIO = /(?<![\d:])([01]?\d|2[0-3])[:.]([0-5]\d)(?![\d:])/g;
const DIA = /^\W{0,2}(\d{1,2})(?=\s|[|\])]|$)/;

// Texto do OCR → leitura do cartão, ou null quando o texto não é confiável: nome com confiança baixa,
// linha de dia com horário de confiança baixa ou número ímpar de marcas (batida faltando ou lida a menos).
// O cartão tem 3 pares: manhã, tarde e a coluna Extra. ponytail: OCR de letra à mão e carimbo
// desbotado raramente passa daqui (ver docs/deploy/leitura-de-cartao.md); a visão assume.
export function lerTextoDoCartao(linhas: LinhaLida[]): LeituraDoCartao | null {
  const nome = nomeDoEmpregado(linhas);
  const dias: LeituraDoCartao["dias"] = [];

  for (const { texto, confianca } of linhas) {
    const dia = DIA.exec(texto.trim());
    const marcas = [...texto.matchAll(HORARIO)].map((m) => Number(m[1]) * 60 + Number(m[2]));
    if (!dia || marcas.length === 0) continue;
    if (confianca < CONFIANCA_MINIMA || marcas.length % 2 !== 0 || marcas.length > 6) return null;
    const pares = Array.from({ length: marcas.length / 2 }, (_, i) => ({
      entrada: marcas[2 * i],
      saida: marcas[2 * i + 1],
    }));
    dias.push({
      dia: Number(dia[1]),
      batidas: pares.slice(0, 2),
      extra: pares[2] ?? null,
      atestado: false,
      faltou: false,
    });
  }
  return { nome, dias };
}

function nomeDoEmpregado(linhas: LinhaLida[]): string | null {
  const i = linhas.findIndex((l) => /^\W*empregado\b/i.test(l.texto.trim()));
  if (i < 0) return null;
  const mesma = linhas[i].texto.trim().replace(/^\W*empregado\b/i, "");
  const fonte = /\p{L}{2}/u.test(mesma) ? linhas[i] : linhas[i + 1];
  if (!fonte || fonte.confianca < CONFIANCA_MINIMA) return null;
  const texto = (fonte === linhas[i] ? mesma : fonte.texto).replace(/[^\p{L} ]/gu, "").trim();
  return texto.length >= 2 ? texto : null;
}
