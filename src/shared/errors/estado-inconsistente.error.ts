import { AppError } from "@/shared/errors/app.error";

// Devolutiva técnica PR #61/#64: falha da própria compensação
// (rollback) precisa ser distinguível do erro original pro chamador — não dá
// pra saber, só olhando pro erro, se o estado ficou consistente ou não.
// `referenciaId` aponta o recurso a reconciliar (conta Auth, Cliente...).
export class EstadoInconsistenteError extends AppError {
  readonly code = "INCONSISTENT_STATE";

  constructor(
    message: string,
    readonly referenciaId: string,
  ) {
    super(message);
  }
}
