import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ContaCriada = { id: string; senhaProvisoria: string };

export interface AuthAdminPort {
  criarConta(email: string): Promise<Result<ContaCriada, AppError>>;
  removerConta(id: string): Promise<Result<void, AppError>>;
  banirConta(id: string): Promise<Result<void, AppError>>;
}
