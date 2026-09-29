import { ValidationError } from "@/shared/errors/validation.error";
import { PARCELAMENTO_STATUSES, type ParcelamentoStatusValor } from "@/shared/kernel/parcelamento-status";
import { err, ok, type Result } from "@/shared/kernel/result";

export class ParcelamentoStatus {
  private constructor(private readonly props: { valor: ParcelamentoStatusValor }) {}

  static criar(entrada: string): Result<ParcelamentoStatus, ValidationError> {
    if (!PARCELAMENTO_STATUSES.includes(entrada as ParcelamentoStatusValor)) {
      return err(new ValidationError(`Status de parcelamento inválido: ${entrada}`));
    }
    return ok(new ParcelamentoStatus({ valor: entrada as ParcelamentoStatusValor }));
  }

  get valor(): ParcelamentoStatusValor {
    return this.props.valor;
  }
}
