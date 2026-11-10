import type { EscopoDoAplica } from "@/modules/rh/application/dtos/acompanhamento.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type MarcarServicoAcompanhamentoInput = {
  clienteId: string;
  servicoId: string;
  competencia: string;
  concluido: boolean;
};

export type DefinirServicoAplicavelInput = {
  clienteId: string;
  servicoId: string;
  competencia: string;
  escopo: EscopoDoAplica;
};

export interface MarcarServicoAcompanhamentoPort {
  execute(input: MarcarServicoAcompanhamentoInput): Promise<Result<void, AppError>>;
}
export interface DefinirServicoAplicavelPort {
  execute(input: DefinirServicoAplicavelInput): Promise<Result<void, AppError>>;
}
