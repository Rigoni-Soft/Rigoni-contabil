import type { Andamento } from "@/modules/atendimento/application/jobs/alertas-da-rodada";
import type { ClienteParaParcelamento } from "@/modules/atendimento/application/ports/out/clientes-para-parcelamento.provider";

// Núcleo do envio das guias de parcelamento comum do Cliente, para o job e a URA: o que saiu e o
// que o setor precisa saber (falha de envio, parcelamento sem guia).
export type EnviarGuiasParcelamentoInput = { cliente: ClienteParaParcelamento; agora: Date };

export interface EnviarGuiasParcelamentoPort {
  execute(entrada: EnviarGuiasParcelamentoInput): Promise<Andamento>;
}
