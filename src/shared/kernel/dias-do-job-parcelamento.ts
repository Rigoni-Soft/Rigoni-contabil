import { diaDoMes, ultimoDiaDoMes } from "./mes-atual";

// Dias do mês (fuso de São Paulo) em que o job envia a guia de parcelamento. Fonte única: o job decide
// se roda e o dashboard decide quando o "pendente" vira "em atraso".
export const DIAS_DO_JOB_PARCELAMENTO = [20, 22, 24, 26, 28];

// Primeiro dia depois da última rodada: parcela do mês ainda sem envio daqui em diante é atraso nosso.
export const PRIMEIRO_DIA_EM_ATRASO = Math.max(...DIAS_DO_JOB_PARCELAMENTO) + 1;

// Em mês com menos dias que isso (fevereiro comum) o dia 29 não existe: o atraso começa no último dia.
export const primeiroDiaEmAtraso = (agora: Date): number =>
  Math.min(PRIMEIRO_DIA_EM_ATRASO, ultimoDiaDoMes(agora));

// Hoje (São Paulo) já é dia de atraso: a parcela do mês ainda sem envio é atraso nosso.
export const jaEmAtraso = (agora: Date): boolean => diaDoMes(agora) >= primeiroDiaEmAtraso(agora);
