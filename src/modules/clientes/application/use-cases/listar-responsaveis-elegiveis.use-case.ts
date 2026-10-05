import type {
  ClienteQueryPort,
  ResponsavelOpcaoDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Sem checagem de papel: é só leitura (RLS de `perfis` já limita ao mesmo
// Setor) e a UI só chama quando o Líder abre o campo Responsável (#65).
export class ListarResponsaveisElegiveis {
  constructor(private readonly query: ClienteQueryPort) {}

  async execute(): Promise<Result<ResponsavelOpcaoDto[], AppError>> {
    return this.query.listarResponsaveisElegiveis();
  }
}
