import { ValidationError } from "@/shared/errors/validation.error";
import { DAS_STATUSES, type DasStatusValor } from "@/shared/kernel/das-status";
import { err, ok, type Result } from "@/shared/kernel/result";

export class DasStatus {
  private constructor(private readonly props: { valor: DasStatusValor }) {}

  static criar(entrada: string): Result<DasStatus, ValidationError> {
    if (!DAS_STATUSES.includes(entrada as DasStatusValor)) {
      return err(new ValidationError(`Status de DAS inválido: ${entrada}`));
    }
    return ok(new DasStatus({ valor: entrada as DasStatusValor }));
  }

  get valor(): DasStatusValor {
    return this.props.valor;
  }
}
