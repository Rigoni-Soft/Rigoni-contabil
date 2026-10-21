import { ValidationError } from "@/shared/errors/validation.error";
import { erroDoNumero } from "@/shared/kernel/numero-alteracao";
import { err, ok, type Result } from "@/shared/kernel/result";

export type AlteracaoContratualProps = { numero: number; data: Date; arquivoCaminho: string };

export class AlteracaoContratual {
  private constructor(private readonly props: Readonly<AlteracaoContratualProps>) {}

  static criar(
    numero: number,
    data: string,
    arquivoCaminho: string,
  ): Result<AlteracaoContratual, ValidationError> {
    const erroNumero = erroDoNumero(numero, []);
    if (erroNumero) return err(new ValidationError(erroNumero));
    const dataConvertida = new Date(data);
    if (Number.isNaN(dataConvertida.getTime())) {
      return err(new ValidationError(`Data de alteração contratual inválida: ${data}`));
    }
    if (!arquivoCaminho.trim()) {
      return err(new ValidationError("Alteração contratual sem arquivo anexado."));
    }
    return ok(new AlteracaoContratual({ numero, data: dataConvertida, arquivoCaminho }));
  }

  get numero(): number {
    return this.props.numero;
  }

  get data(): Date {
    return this.props.data;
  }

  get arquivoCaminho(): string {
    return this.props.arquivoCaminho;
  }
}
