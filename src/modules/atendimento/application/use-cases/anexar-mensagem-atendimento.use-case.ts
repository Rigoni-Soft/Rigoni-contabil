import type { NovaMensagem } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AnexarMensagemAtendimentoPort } from "@/modules/atendimento/application/ports/in/anexar-mensagem-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

export class AnexarMensagemAtendimento implements AnexarMensagemAtendimentoPort {
  constructor(private readonly repositorio: AtendimentoRepositoryPort) {}

  async execute(
    chave: string,
    mensagem: NovaMensagem,
  ): Promise<Result<{ anexada: boolean }, AppError>> {
    const resultado = await this.repositorio.anexarMensagem(chave, mensagem);
    if (!resultado.ok) return resultado;
    return ok({ anexada: resultado.value.status === "anexada" });
  }
}
