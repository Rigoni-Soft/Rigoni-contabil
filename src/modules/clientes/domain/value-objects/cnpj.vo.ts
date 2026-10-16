import { ValidationError } from "@/shared/errors/validation.error";
import { cnpjValido, normalizarCnpj } from "@/shared/kernel/cnpj";
import { err, ok, type Result } from "@/shared/kernel/result";

// O domínio é a autoridade final da validação (a UI só dá feedback cedo). `valor`
// é a forma canônica: 14 caracteres [0-9A-Z], sem pontuação.
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
