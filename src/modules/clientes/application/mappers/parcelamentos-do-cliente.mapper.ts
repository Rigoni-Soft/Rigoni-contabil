import type { ResumoOperacionalRow } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { jaEmAtraso } from "@/shared/kernel/dias-do-job-parcelamento";

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
    pendenteEmAtraso: pendente && jaEmAtraso(agora),
    interno: abertos.some((p) => p.interno),
    enviado: abertos.length > 0 && !pendente,
  };
}
