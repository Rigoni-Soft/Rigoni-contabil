import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ClienteParaParcelamento = { empresa: string; clienteId: string };

export interface ClientesParaParcelamentoPort {
  listarPendentes(): Promise<Result<ClienteParaParcelamento[], AppError>>;
  reservar(clienteId: string): Promise<Result<string | null, AppError>>;
  concluir(clienteId: string, token: string): Promise<Result<boolean, AppError>>;
  liberar(clienteId: string, token: string): Promise<Result<void, AppError>>;
}
