import type { DadosDoAcordo } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// O conjunto inteiro do Cliente: o que não vier na lista é removido. `id` ausente = Parcelamento
// novo (o PDF é obrigatório); com `id` = já cadastrado (o PDF não troca).
export type SalvarParcelamentosClienteInput = {
  clienteId: string;
  parcelamentos: {
    id?: string;
    codigo: string;
    parcelasRestantes: number;
    interno: boolean;
    arquivo?: File;
    // Lidos do PDF (só no Parcelamento novo); o caso de uso os revalida.
    acordo?: DadosDoAcordo;
  }[];
};

// `ids`: o id de cada Parcelamento, na ordem enviada (o novo só ganha id aqui).
export interface SalvarParcelamentosClientePort {
  execute(input: SalvarParcelamentosClienteInput): Promise<Result<{ ids: string[] }, AppError>>;
}
