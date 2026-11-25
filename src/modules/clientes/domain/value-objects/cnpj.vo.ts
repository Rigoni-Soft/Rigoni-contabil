import { ValidationError } from "@/shared/errors/validation.error";
import { cnpjValido, normalizarCnpj } from "@/shared/kernel/cnpj";
import { err, ok, type Result } from "@/shared/kernel/result";

export class Cnpj {
  private constructor(private readonly props: { valor: string }) {}

  static criar(entrada: string): Result<Cnpj, ValidationError> {
    if (!cnpjValido(entrada)) return err(new ValidationError(`CNPJ inválido: ${entrada}`));
    return ok(new Cnpj({ valor: normalizarCnpj(entrada) }));
  }

  get valor(): string {
    return this.props.valor;
  }
}
