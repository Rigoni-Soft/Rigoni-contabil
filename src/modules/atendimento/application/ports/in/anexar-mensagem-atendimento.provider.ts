import type { NovaMensagem } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface AnexarMensagemAtendimentoPort {
  // Mensagem de um número que já tem Atendimento em andamento entra nele, sem recomeçar a URA.
  // `anexada: false` = não havia Atendimento em andamento para o número.
  execute(chave: string, mensagem: NovaMensagem): Promise<Result<{ anexada: boolean }, AppError>>;
}
