import type {
  AnexarMensagemAtendimentoPort,
  AnexarMensagemInput,
  AnexarMensagemOutput,
} from "@/modules/atendimento/application/ports/in/anexar-mensagem-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export class AnexarMensagemAtendimento implements AnexarMensagemAtendimentoPort {
  constructor(private readonly repositorio: AtendimentoRepositoryPort) {}

  execute({
    chave,
    mensagem,
  }: AnexarMensagemInput): Promise<Result<AnexarMensagemOutput, AppError>> {
    return this.repositorio.anexarMensagem(chave, mensagem);
  }
}
