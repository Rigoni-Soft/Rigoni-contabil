import type { SessaoAtendimento } from "@/modules/atendimento/application/ports/out/sessao-atendimento.provider";

export const ETAPAS_IDENTIFICACAO = ["ja_cliente", "cnpj", "cnpj_nova_tentativa"] as const;
export type EtapaIdentificacao = (typeof ETAPAS_IDENTIFICACAO)[number];

// Só as etapas da identificação contam respostas inválidas; as demais valem 0.
export function invalidosDe(sessao: SessaoAtendimento | null): number {
  return sessao && "invalidos" in sessao ? sessao.invalidos : 0;
}
