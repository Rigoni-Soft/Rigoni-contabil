import { AppError } from "@/shared/errors/app.error";

// Devolutiva técnica PR #61, ajuste residual: falha da própria compensação
// (rollback) precisa ser distinguível do erro original pro chamador — não dá
// pra saber, só olhando pro erro, se o estado ficou consistente ou não.
export class EstadoInconsistenteError extends AppError {
  readonly code = "INCONSISTENT_STATE";

  constructor(
    message: string,
    readonly contaId: string,
  ) {
    super(message);
  }
}
