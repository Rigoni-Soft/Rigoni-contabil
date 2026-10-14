import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Mesmo formato e limite do `check` da coluna `clientes.email`. O domínio é a autoridade final;
// a UI só dá feedback cedo.
const FORMATO = /^[^@\s]+@[^@\s]+$/;
const TAMANHO_MAXIMO = 254;

export class Email {
  private constructor(private readonly props: { valor: string }) {}

  static criar(entrada: string): Result<Email, ValidationError> {
    const valor = entrada.trim();
    if (valor.length > TAMANHO_MAXIMO || !FORMATO.test(valor)) {
      return err(new ValidationError("e-mail inválido"));
    }
    return ok(new Email({ valor }));
  }

  get valor(): string {
    return this.props.valor;
  }
}
