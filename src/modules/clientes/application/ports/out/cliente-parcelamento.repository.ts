import type { ParcelamentoProps } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type ParcelamentoSalvo = ParcelamentoProps & {
  quitado: boolean;
  temEnvio: boolean;
  enviadoNoMes: boolean;
};

export interface ClienteParcelamentoRepository {
  listar(clienteId: string, setor: SetorSlug): Promise<Result<ParcelamentoSalvo[], AppError>>;
  salvar(
    clienteId: string,
    setor: SetorSlug,
    itens: ParcelamentoProps[],
  ): Promise<Result<void, AppError>>;
}
