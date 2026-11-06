// Porta própria (arquitetura.md, seção 3.11: módulos não se importam): o `main`
// adapta a sessão real do módulo usuarios a esta forma, sem clientes conhecer
// tipos de outro módulo. Inclui o Setor do ator porque a auditoria de
// "cliente.criar" registra o Setor de quem cadastrou (Cliente não tem Setor
// próprio nesta rodada — CONTEXT.md, termo "Cliente").
export type AtorSessaoDto = { id: string; papel: string; setor: string };

export interface SessaoPort {
  usuarioAtual(): Promise<AtorSessaoDto | null>;
}
