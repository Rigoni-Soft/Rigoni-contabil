import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// `id` ausente = Parcelamento novo (o PDF é obrigatório); com `id` = já cadastrado (o PDF não troca).
export type ParcelamentoEntrada = {
  id?: string;
  codigo: string;
  parcelasRestantes: number;
  interno: boolean;
  arquivo?: File;
};

// O conjunto inteiro do Cliente: o que não vier na lista é removido.
export type SalvarParcelamentosClienteInput = {
  clienteId: string;
  parcelamentos: ParcelamentoEntrada[];
};

export interface SalvarParcelamentosClientePort {
  execute(input: SalvarParcelamentosClienteInput): Promise<Result<void, AppError>>;
}
