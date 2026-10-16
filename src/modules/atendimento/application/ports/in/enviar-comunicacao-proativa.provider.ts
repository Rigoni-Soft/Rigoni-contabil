import type { ComunicacaoProativa } from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type EnviarComunicacaoProativaInput = {
  telefone: string;
  comunicacao: ComunicacaoProativa;
  ultimaMensagemDoContatoEm: Date | null;
  agora: Date;
};

export interface EnviarComunicacaoProativaPort {
  execute(entrada: EnviarComunicacaoProativaInput): Promise<Result<void, AppError>>;
}
