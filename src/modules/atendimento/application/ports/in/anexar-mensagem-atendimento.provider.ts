import type { NovaMensagem } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type AnexarMensagemInput = { chave: string; mensagem: NovaMensagem };
export type AnexarMensagemOutput = { anexada: boolean };

export interface AnexarMensagemAtendimentoPort {
  execute(input: AnexarMensagemInput): Promise<Result<AnexarMensagemOutput, AppError>>;
}
