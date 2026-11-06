import type { ClienteDto } from "@/modules/clientes/application/dtos/cliente.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type AlteracaoContratualInput = { numero: number; data: string; arquivo: File };

export type CriarClienteInput = {
  empresa: string;
  cnpj: string;
  regime: string;
  email?: string;
  contratoSocial?: File;
  alteracoesContratuais: AlteracaoContratualInput[];
};

export type CriarClienteOutput = { cliente: ClienteDto };

export interface CriarClientePort {
  execute(input: CriarClienteInput): Promise<Result<CriarClienteOutput, AppError>>;
}
