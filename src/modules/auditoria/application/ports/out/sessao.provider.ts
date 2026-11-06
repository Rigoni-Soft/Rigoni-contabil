// Porta própria (arquitetura.md, seção 3.11: módulos não se importam): o `main`
// adapta a sessão real do módulo usuarios a esta forma, sem a auditoria conhecer
// tipos de outro módulo.
export type AtorSessaoDto = { id: string; papel: string };

export interface SessaoPort {
  usuarioAtual(): Promise<AtorSessaoDto | null>;
}
