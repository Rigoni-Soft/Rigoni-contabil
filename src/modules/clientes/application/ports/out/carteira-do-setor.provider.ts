import type { ParcelamentoDoResumo } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// Um Cliente da carteira de um Setor com o Responsável dele naquele Setor (nulo = "Sem responsável").
// A RLS decide o que o ator enxerga: o Funcionário só os próprios vínculos, o Líder e o Admin todos.
export type ClienteDaCarteiraRow = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  responsavelId: string | null;
  responsavelNome: string | null;
  // Os Parcelamentos que o Setor cadastrou para o Cliente (os dos outros Setores não entram).
  parcelamentos: ParcelamentoDoResumo[];
};

export interface CarteiraDoSetorQueryPort {
  listar(setor: SetorSlug): Promise<Result<ClienteDaCarteiraRow[], AppError>>;
}
