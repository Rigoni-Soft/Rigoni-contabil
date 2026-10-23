import { AppError } from "@/shared/errors/app.error";

// Por que o provedor fiscal não emitiu a guia de um parcelamento (docs/contratos/obrigacoes-fiscais.md).
// Falha esperada, diferente da indisponibilidade (`ServicoExternoError`, que repete): cada motivo
// pede uma ação do consumidor, nenhuma é repetir.
export type MotivoGuiaIndisponivel =
  "codigo_desconhecido" | "quitado" | "fora_do_periodo" | "ambiguo";

const MENSAGEM: Record<MotivoGuiaIndisponivel, string> = {
  codigo_desconhecido: "O provedor fiscal não tem este parcelamento.",
  quitado: "Parcelamento quitado no provedor fiscal.",
  fora_do_periodo: "Parcela indisponível para emissão neste período.",
  ambiguo: "Mais de um parcelamento em aberto: a guia não se atribui a um só.",
};

export class GuiaParcelamentoIndisponivelError extends AppError {
  readonly code = "GUIA_PARCELAMENTO_INDISPONIVEL";

  constructor(readonly motivo: MotivoGuiaIndisponivel) {
    super(MENSAGEM[motivo]);
  }
}
