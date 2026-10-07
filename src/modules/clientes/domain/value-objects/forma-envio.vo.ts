import { ValidationError } from "@/shared/errors/validation.error";
import { FORMAS_ENVIO, type FormaEnvioValor } from "@/shared/kernel/forma-envio";
import { err, ok, type Result } from "@/shared/kernel/result";

export class FormaEnvio {
  private constructor(private readonly props: { valor: FormaEnvioValor }) {}

  static criar(entrada: string): Result<FormaEnvio, ValidationError> {
    if (!FORMAS_ENVIO.includes(entrada as FormaEnvioValor)) {
      return err(new ValidationError(`Forma de envio inválida: ${entrada}`));
    }
    return ok(new FormaEnvio({ valor: entrada as FormaEnvioValor }));
  }

  get valor(): FormaEnvioValor {
    return this.props.valor;
  }
}
