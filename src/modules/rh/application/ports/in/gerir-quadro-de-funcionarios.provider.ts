import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type CadastrarEmpregadoInput = {
  clienteId: string;
  nome: string;
  jornada: number[];
  // Sem a marca, vale o padrão do Cliente.
  comissionado?: boolean;
};
export type CorrigirEmpregadoInput = {
  empregadoId: string;
  nome: string;
  jornada: number[];
  comissionado: boolean;
};
export type DefinirEmpregadoAtivoInput = { empregadoId: string; ativo: boolean };
export type DefinirSemMovimentoInput = { empregadoId: string; competencia: string; sem: boolean };
export type DefinirPadraoComissionadosInput = { clienteId: string; comissionados: boolean };

export interface CadastrarEmpregadoPort {
  execute(input: CadastrarEmpregadoInput): Promise<Result<void, AppError>>;
}
export interface CorrigirEmpregadoPort {
  execute(input: CorrigirEmpregadoInput): Promise<Result<void, AppError>>;
}
export interface DefinirEmpregadoAtivoPort {
  execute(input: DefinirEmpregadoAtivoInput): Promise<Result<void, AppError>>;
}
export interface DefinirSemMovimentoPort {
  execute(input: DefinirSemMovimentoInput): Promise<Result<void, AppError>>;
}
export interface DefinirPadraoComissionadosPort {
  execute(input: DefinirPadraoComissionadosInput): Promise<Result<void, AppError>>;
}
