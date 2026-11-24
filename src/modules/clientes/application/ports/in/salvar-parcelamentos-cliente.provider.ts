import type { DadosDoAcordo } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type SalvarParcelamentosClienteInput = {
  clienteId: string;
  setor: SetorSlug;
  parcelamentos: {
    id?: string;
    codigo: string;
    parcelasRestantes: number;
    interno: boolean;
    arquivo?: File;
    acordo?: DadosDoAcordo;
  }[];
};

export interface SalvarParcelamentosClientePort {
  execute(input: SalvarParcelamentosClienteInput): Promise<Result<{ ids: string[] }, AppError>>;
}
