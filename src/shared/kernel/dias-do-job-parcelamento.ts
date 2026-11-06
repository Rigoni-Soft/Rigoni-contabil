import { diaDoMes, ultimoDiaDoMes } from "./mes-atual";

// Dias do mês (fuso de São Paulo) em que o job envia a guia de parcelamento. Fonte única: o job decide
// se roda e o dashboard decide quando o "pendente" vira "em atraso".
export const DIAS_DO_JOB_PARCELAMENTO = [20, 22, 24, 26, 28];

// Primeiro dia depois da última rodada (29): parcela do mês ainda sem envio daqui em diante é atraso
// nosso. Em fevereiro comum o dia 29 não existe: o atraso começa no último dia do mês.
export const primeiroDiaEmAtraso = (agora: Date): number =>
  Math.min(Math.max(...DIAS_DO_JOB_PARCELAMENTO) + 1, ultimoDiaDoMes(agora));

// Hoje (São Paulo) já é dia de atraso: a parcela do mês ainda sem envio é atraso nosso.
export const jaEmAtraso = (agora: Date): boolean => diaDoMes(agora) >= primeiroDiaEmAtraso(agora);

// A frase que a tela diz quando uma guia é liberada: quando ela sai.
export const TEXTO_ENVIO_AUTOMATICO = `Sai no envio automático (dias ${DIAS_DO_JOB_PARCELAMENTO.join(", ")}) ou quando o Cliente pedir`;
