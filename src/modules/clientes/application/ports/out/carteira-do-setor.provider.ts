import type { ParcelamentoDoResumo } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type ClienteDaCarteiraRow = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  responsavelId: string | null;
  responsavelNome: string | null;
  parcelamentos: ParcelamentoDoResumo[];
};

export interface CarteiraDoSetorQueryPort {
  listar(setor: SetorSlug): Promise<Result<ClienteDaCarteiraRow[], AppError>>;
}
