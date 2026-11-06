import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import { mesAtual } from "@/shared/kernel/mes-atual";

// Os tipos do organismo passam por aqui: o hook (que não importa a View) os recebe do presenter.
export type {
  AcaoDaGuia,
  AcoesDasGuias,
  DadosDoAnexo,
  ResultadoDaGuia,
} from "@/presentation/components/organisms/guias-da-parcela-pgfn.component";

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

// Id do botão Remover da guia: o foco volta a ele quando a confirmação é cancelada.
export const idDaRemocao = (prefixo: string, competencia: string) =>
  `${idDaGuia(prefixo, competencia)}-remover`;

// Id do botão que abre a conferência da liberação: o foco volta a ele quando ela é cancelada.
export const idDaLiberacao = (prefixo: string, competencia: string) =>
  `${idDaGuia(prefixo, competencia)}-liberar`;

// Id da região das guias: o foco volta a ela quando a guia removida leva o botão embora.
export const idDaRegiao = (prefixo: string) => `${prefixo}-regiao`;

export const linhasDeGuias = (guias: GuiaDaParcela[], prefixo: string) =>
  guias.map((guia) => ({
    id: idDaGuia(prefixo, guia.competencia),
    competencia: guia.competencia,
    rotulo: rotuloDaCompetencia(guia.competencia),
    contaNegociacao: guia.contaNegociacao,
    confirmada: guia.estado === "confirmada",
    motivo: guia.motivo,
    enviada: guia.enviada === true,
    idDaRemocao: idDaRemocao(prefixo, guia.competencia),
    idDaLiberacao: idDaLiberacao(prefixo, guia.competencia),
  }));

// Rótulo ("10/2026") da guia do mês corrente que ainda não foi anexada, para o aviso de que falta; nulo
// se não há nenhuma guia (a lista já diz que não há) ou se a do mês já está lá.
export const competenciaEmFalta = (guias: GuiaDaParcela[], agora = new Date()) => {
  const mes = mesAtual(agora).replace("-", "");
  if (guias.length === 0 || guias.some((g) => g.competencia === mes)) return undefined;
  return rotuloDaCompetencia(mes);
};
