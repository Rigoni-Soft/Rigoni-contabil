import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export type AlteracaoContratualProps = { data: Date; arquivoCaminho: string };

export class AlteracaoContratual {
  private constructor(private readonly props: Readonly<AlteracaoContratualProps>) {}

  static criar(data: string, arquivoCaminho: string): Result<AlteracaoContratual, ValidationError> {
    const dataConvertida = new Date(data);
    if (Number.isNaN(dataConvertida.getTime())) {
      return err(new ValidationError(`Data de alteração contratual inválida: ${data}`));
    }
    if (!arquivoCaminho.trim()) {
      return err(new ValidationError("Alteração contratual sem arquivo anexado."));
    }
    return ok(new AlteracaoContratual({ data: dataConvertida, arquivoCaminho }));
  }

  get data(): Date {
    return this.props.data;
  }

  get arquivoCaminho(): string {
    return this.props.arquivoCaminho;
  }
}
