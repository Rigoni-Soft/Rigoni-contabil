import { ValidationError } from "@/shared/errors/validation.error";
import { erroDeFormato } from "@/shared/kernel/numero-alteracao";
import { err, ok, type Result } from "@/shared/kernel/result";

export type AlteracaoContratualProps = { numero: number; data: Date; arquivoCaminho: string };

export class AlteracaoContratual {
  private constructor(private readonly props: Readonly<AlteracaoContratualProps>) {}

  static criar(
    numero: number,
    data: string,
    arquivoCaminho: string,
  ): Result<AlteracaoContratual, ValidationError> {
    const erroNumero = erroDeFormato(numero);
    if (erroNumero) return err(new ValidationError(erroNumero));
    // Só "AAAA-MM-DD" real: `new Date` aceitaria "01/01/2100" e rolaria "2026-02-30" para março.
    const dataConvertida = new Date(data);
    const valida =
      /^\d{4}-\d{2}-\d{2}$/.test(data) &&
      !Number.isNaN(dataConvertida.getTime()) &&
      dataConvertida.toISOString().slice(0, 10) === data;
    if (!valida) {
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
