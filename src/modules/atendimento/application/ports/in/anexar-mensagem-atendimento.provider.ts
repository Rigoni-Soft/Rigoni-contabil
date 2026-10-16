import type { NovaMensagem } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type AnexarMensagemInput = { chave: string; mensagem: NovaMensagem };
// `anexada: false` = não havia Atendimento em andamento para o número.
export type AnexarMensagemOutput = { anexada: boolean };

export interface AnexarMensagemAtendimentoPort {
  // Mensagem de um número que já tem Atendimento em andamento entra nele, sem recomeçar a URA.
  execute(input: AnexarMensagemInput): Promise<Result<AnexarMensagemOutput, AppError>>;
}
