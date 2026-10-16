import { AppError } from "@/shared/errors/app.error";

// A falha da própria compensação (rollback) precisa ser distinguível do erro original pro chamador:
// só olhando o erro não dá pra saber se o estado ficou consistente. `referenciaId` aponta o
// recurso a reconciliar (conta Auth, Cliente...).
export class EstadoInconsistenteError extends AppError {
  readonly code = "INCONSISTENT_STATE";

  constructor(
    message: string,
    readonly referenciaId: string,
  ) {
    super(message);
  }
}
