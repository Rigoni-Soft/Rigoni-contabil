import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface GuiasParcelamentoPort {
  buscarGuiasParcelamento(
    clienteId: string,
    ignorar: readonly string[],
  ): Promise<Result<GuiaFiscal[], AppError>>;
}
