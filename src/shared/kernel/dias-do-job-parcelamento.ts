// Dias do mês (fuso de São Paulo) em que o job envia a guia de parcelamento. Fonte única: o job decide
// se roda e o dashboard decide quando o "pendente" vira "em atraso".
export const DIAS_DO_JOB_PARCELAMENTO = [20, 22, 24, 26, 28];

// Primeiro dia depois da última rodada: parcela do mês ainda sem envio daqui em diante é atraso nosso.
// ponytail: em fevereiro (28 dias) o dia 29 não existe, então o atraso não aparece nesse mês; se
// importar, comparar com o último dia do mês em vez do dia fixo.
export const PRIMEIRO_DIA_EM_ATRASO = Math.max(...DIAS_DO_JOB_PARCELAMENTO) + 1;
