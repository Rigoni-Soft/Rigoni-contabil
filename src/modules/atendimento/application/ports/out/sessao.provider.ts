// Porta própria (arquitetura.md, seção 3.11: módulos não se importam): o `main` adapta a
// sessão do módulo usuarios a esta forma.
export type AtorSessaoDto = { id: string; papel: string; setor: string };

export interface SessaoPort {
  usuarioAtual(): Promise<AtorSessaoDto | null>;
}
