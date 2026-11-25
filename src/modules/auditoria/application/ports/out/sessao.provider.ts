export type AtorSessaoDto = { id: string; papel: string };

export interface SessaoPort {
  usuarioAtual(): Promise<AtorSessaoDto | null>;
}
