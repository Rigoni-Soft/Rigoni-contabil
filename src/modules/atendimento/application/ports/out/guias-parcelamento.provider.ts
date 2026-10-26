import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface GuiasParcelamentoPort {
  // Todas as guias de parcelamento que o provedor emite hoje para o CNPJ do Cliente (0..n, uma por
  // parcela), sem as parcelas de `ignorar` (AAAAMM, já entregues: cada emissão é cobrada). O
  // provedor não diz de qual parcelamento é cada uma.
  buscarGuiasParcelamento(
    clienteId: string,
    ignorar: readonly string[],
  ): Promise<Result<GuiaFiscal[], AppError>>;
}
