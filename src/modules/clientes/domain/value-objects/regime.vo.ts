import { ValidationError } from "@/shared/errors/validation.error";
import { REGIMES, type RegimeValor } from "@/shared/kernel/regimes";
import { err, ok, type Result } from "@/shared/kernel/result";

export { REGIMES, type RegimeValor };

export class Regime {
  private constructor(private readonly props: { valor: RegimeValor }) {}

  static criar(entrada: string): Result<Regime, ValidationError> {
    if (!REGIMES.includes(entrada as RegimeValor)) {
      return err(new ValidationError(`Regime inválido: ${entrada}`));
    }
    return ok(new Regime({ valor: entrada as RegimeValor }));
  }

  get valor(): RegimeValor {
    return this.props.valor;
  }
}
