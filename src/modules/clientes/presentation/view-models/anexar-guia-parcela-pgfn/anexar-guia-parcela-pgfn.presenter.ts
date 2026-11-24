import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import { mesAtual } from "@/shared/kernel/mes-atual";

export type {
  AcaoDaGuia,
  AcoesDasGuias,
  DadosDoAnexo,
  ResultadoDaGuia,
} from "@/presentation/components/organisms/guias-da-parcela-pgfn.component";

const rotuloDaCompetencia = (competencia: string) =>
  `${competencia.slice(4)}/${competencia.slice(0, 4)}`;

export function competenciaDoMes(mes: string) {
  const texto = mes.trim();
  const mesAno = /^(\d{1,2})\/(\d{4})$/.exec(texto);
  if (mesAno) return `${mesAno[2]}${mesAno[1].padStart(2, "0")}`;
  return texto.replace("-", "");
}

export const idDaGuia = (prefixo: string, competencia: string) => `${prefixo}-guia-${competencia}`;

export const idDaRemocao = (prefixo: string, competencia: string) =>
  `${idDaGuia(prefixo, competencia)}-remover`;

export const idDaLiberacao = (prefixo: string, competencia: string) =>
  `${idDaGuia(prefixo, competencia)}-liberar`;

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

export const competenciaEmFalta = (guias: GuiaDaParcela[], agora = new Date()) => {
  const mes = mesAtual(agora).replace("-", "");
  if (guias.length === 0 || guias.some((g) => g.competencia === mes)) return undefined;
  return rotuloDaCompetencia(mes);
};
