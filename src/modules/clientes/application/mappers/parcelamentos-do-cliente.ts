import type { ResumoOperacionalRow } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { PRIMEIRO_DIA_EM_ATRASO } from "@/shared/kernel/dias-do-job-parcelamento";
import { diaDoMes } from "@/shared/kernel/mes-atual";

// Definições do grupo Parcelamento, por Cliente (não por parcelamento): os cards e os comparativos
// leem daqui, então os números batem. Um Cliente cai em vários destes ao mesmo tempo.
export type SituacaoParcelamentosDoCliente = {
  comParcelamento: boolean;
  emAberto: boolean;
  pendente: boolean;
  pendenteEmAtraso: boolean;
  interno: boolean;
  enviado: boolean;
};

export function situacaoDosParcelamentos(
  { parcelamentos }: Pick<ResumoOperacionalRow, "parcelamentos">,
  agora: Date,
): SituacaoParcelamentosDoCliente {
  const abertos = parcelamentos.filter((p) => !p.quitado);
  const pendente = abertos.some((p) => !p.enviadoNoMes);
  return {
    comParcelamento: parcelamentos.length > 0,
    emAberto: abertos.length > 0,
    pendente,
    pendenteEmAtraso: pendente && diaDoMes(agora) >= PRIMEIRO_DIA_EM_ATRASO,
    interno: abertos.some((p) => p.interno),
    enviado: abertos.length > 0 && !pendente,
  };
}
