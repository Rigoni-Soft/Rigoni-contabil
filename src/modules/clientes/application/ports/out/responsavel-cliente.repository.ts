import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export interface ResponsavelClienteRepository {
  // `responsavelId` null remove. O Simples Nacional guarda o Responsável no cadastro operacional; os
  // demais Setores, em `cliente_responsaveis`.
  atribuir(
    clienteId: string,
    setor: SetorSlug,
    responsavelId: string | null,
  ): Promise<Result<void, AppError>>;
}
