import type { Papel } from "@/shared/kernel/papeis";
import type { SetorSlug } from "@/shared/kernel/setores";

export type AtorSessaoDto = { id: string; papel: Papel; setor: SetorSlug };

export interface SessaoPort {
  usuarioAtual(): Promise<AtorSessaoDto | null>;
}
