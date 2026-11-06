import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Quem agiu é sempre um usuário (`auth.users.id`, uuid): a coluna `registros_auditoria.ator` é uuid.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AtorId {
  private constructor(private readonly props: { valor: string }) {}

  static criar(entrada: string): Result<AtorId, ValidationError> {
    if (!UUID.test(entrada)) return err(new ValidationError(`Ator inválido: ${entrada}`));
    return ok(new AtorId({ valor: entrada }));
  }

  get valor(): string {
    return this.props.valor;
  }
}
