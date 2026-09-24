import type {
  ListarSetoresPort,
  SetorDto,
} from "@/modules/usuarios/application/ports/in/listar-setores.provider";
import { SETORES } from "@/modules/usuarios/domain/value-objects/setor.vo";

export class ListarSetores implements ListarSetoresPort {
  async execute(): Promise<SetorDto[]> {
    return SETORES.map((slug) => ({ slug }));
  }
}
