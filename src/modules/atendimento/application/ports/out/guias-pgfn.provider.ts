import type { ParcelamentoDoCliente } from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Guia anexada e confirmada à mão pelo escritório (#183); `caminho` é o PDF no bucket dos acordos.
export type GuiaPgfnConfirmada = { competencia: string; caminho: string };

export type ParcelamentoPgfn = ParcelamentoDoCliente & { guias: GuiaPgfnConfirmada[] };

export interface GuiasPgfnPort {
  // Parcelamentos PGFN em aberto e com parcelas restantes, com as guias confirmadas de cada um.
  listarEmAberto(clienteId: string): Promise<Result<ParcelamentoPgfn[], AppError>>;
  // PDF da guia em base64: sempre do banco, nunca do provedor fiscal. O caminho de outro Cliente é
  // recusado.
  ler(clienteId: string, caminho: string): Promise<Result<string, AppError>>;
}
