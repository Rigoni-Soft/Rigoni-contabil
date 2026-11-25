import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type CriarServicoAcompanhamentoInput = { nome: string };
export type RenomearServicoAcompanhamentoInput = { servicoId: string; nome: string };
export type DesativarServicoAcompanhamentoInput = { servicoId: string };

export interface CriarServicoAcompanhamentoPort {
  execute(input: CriarServicoAcompanhamentoInput): Promise<Result<void, AppError>>;
}
export interface RenomearServicoAcompanhamentoPort {
  execute(input: RenomearServicoAcompanhamentoInput): Promise<Result<void, AppError>>;
}
export interface DesativarServicoAcompanhamentoPort {
  execute(input: DesativarServicoAcompanhamentoInput): Promise<Result<void, AppError>>;
}
