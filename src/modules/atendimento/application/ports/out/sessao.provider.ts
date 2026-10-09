import type { Papel } from "@/shared/kernel/papeis";
import type { SetorSlug } from "@/shared/kernel/setores";

// Porta própria (arquitetura.md, seção 3.11: módulos não se importam): o `main` adapta a
// sessão do módulo usuarios a esta forma.
export type AtorSessaoDto = { id: string; papel: Papel; setor: SetorSlug };

export interface SessaoPort {
  usuarioAtual(): Promise<AtorSessaoDto | null>;
}
