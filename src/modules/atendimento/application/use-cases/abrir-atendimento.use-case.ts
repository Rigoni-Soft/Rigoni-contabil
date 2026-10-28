import type {
  AberturaAtendimento,
  AbrirAtendimentoPort,
  AtendimentoAberto,
} from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Todo Atendimento novo cai na espera do Setor; quem atende é quem o assume (sem atribuição automática).
export class AbrirAtendimento implements AbrirAtendimentoPort {
  constructor(private readonly repositorio: AtendimentoRepositoryPort) {}

  execute(abertura: AberturaAtendimento): Promise<Result<AtendimentoAberto, AppError>> {
    return this.repositorio.abrir(abertura);
  }
}
