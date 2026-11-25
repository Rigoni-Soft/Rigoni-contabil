import type { Andamento } from "@/modules/atendimento/application/jobs/alertas-da-rodada";
import type { ClienteParaParcelamento } from "@/modules/atendimento/application/ports/out/clientes-para-parcelamento.provider";

export type EnviarGuiasParcelamentoInput = { cliente: ClienteParaParcelamento; agora: Date };

export interface EnviarGuiasParcelamentoPort {
  execute(entrada: EnviarGuiasParcelamentoInput): Promise<Andamento>;
}
