import { diaDoMes, ultimoDiaDoMes } from "./mes-atual";

export const DIAS_DO_JOB_PARCELAMENTO = [20, 22, 24, 26, 28];

const ULTIMO_DIA_DE_ENVIO = Math.max(...DIAS_DO_JOB_PARCELAMENTO);

export const primeiroDiaEmAtraso = (agora: Date): number =>
  Math.min(ULTIMO_DIA_DE_ENVIO + 1, ultimoDiaDoMes(agora));

export const jaEmAtraso = (agora: Date): boolean => diaDoMes(agora) >= primeiroDiaEmAtraso(agora);

export const TEXTO_ENVIO_AUTOMATICO = `Sai no envio automático (dias ${DIAS_DO_JOB_PARCELAMENTO.join(", ")}) ou quando o Cliente pedir`;
