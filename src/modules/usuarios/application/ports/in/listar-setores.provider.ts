export type SetorDto = { slug: string };

export interface ListarSetoresPort {
  execute(): Promise<SetorDto[]>;
}
