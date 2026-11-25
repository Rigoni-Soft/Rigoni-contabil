import type {
  AberturaAtendimento,
  AbrirAtendimentoPort,
  AtendimentoAberto,
} from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export class AbrirAtendimento implements AbrirAtendimentoPort {
  constructor(private readonly repositorio: AtendimentoRepositoryPort) {}

  execute(abertura: AberturaAtendimento): Promise<Result<AtendimentoAberto, AppError>> {
    return this.repositorio.abrir(abertura);
  }
}
