import type { ParcelamentoDoCliente } from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type GuiaPgfnConfirmada = { competencia: string; caminho: string };

export type GuiaPgfnEntregue = { competencia: string; caminho: string | null };

export type ParcelamentoPgfn = ParcelamentoDoCliente & {
  guias: GuiaPgfnConfirmada[];
  entregues: GuiaPgfnEntregue[];
};

export interface GuiasPgfnPort {
  listarEmAberto(clienteId: string): Promise<Result<ParcelamentoPgfn[], AppError>>;
  ler(clienteId: string, caminho: string): Promise<Result<string, AppError>>;
  reservar(
    parcelamentoId: string,
    competencia: string,
    caminho: string,
  ): Promise<Result<string | null, AppError>>;
  liberar(
    parcelamentoId: string,
    competencia: string,
    token: string,
  ): Promise<Result<void, AppError>>;
}
