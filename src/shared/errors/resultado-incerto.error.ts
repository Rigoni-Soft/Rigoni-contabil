import { AppError } from "@/shared/errors/app.error";

// Falha de transporte (sem resposta do banco): a transação pode ter confirmado. Quem compensa
// efeito colateral (ex.: remover upload) precisa reconciliar antes, nunca assumir rollback.
export class ResultadoIncertoError extends AppError {
  readonly code = "RESULTADO_INCERTO";
}
