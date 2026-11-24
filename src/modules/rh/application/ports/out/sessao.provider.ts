export type AtorSessaoDto = { id: string; papel: string; setor: string };

export interface SessaoPort {
  usuarioAtual(): Promise<AtorSessaoDto | null>;
}
