import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";

// "202610" → "10/2026".
const rotuloDaCompetencia = (competencia: string) =>
  `${competencia.slice(4)}/${competencia.slice(0, 4)}`;

// Digitado em navegador sem <input type="month"> ("2026-10" ou "10/2026") ou escolhido nele
// ("2026-10") → chave da parcela ("202610"). Outra forma passa adiante e o schema recusa.
export function competenciaDoMes(mes: string) {
  const texto = mes.trim();
  const mesAno = /^(\d{1,2})\/(\d{4})$/.exec(texto);
  if (mesAno) return `${mesAno[2]}${mesAno[1].padStart(2, "0")}`;
  return texto.replace("-", "");
}

// Id do item no DOM: o foco volta a ele quando o botão Confirmar some.
export const idDaGuia = (prefixo: string, competencia: string) => `${prefixo}-guia-${competencia}`;

export const linhasDeGuias = (guias: GuiaDaParcela[], prefixo: string) =>
  guias.map((guia) => ({
    id: idDaGuia(prefixo, guia.competencia),
    competencia: guia.competencia,
    rotulo: rotuloDaCompetencia(guia.competencia),
    contaNegociacao: guia.contaNegociacao,
    confirmada: guia.estado === "confirmada",
  }));
