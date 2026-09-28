import { SETORES, type SetorSlug } from "@/shared/kernel/setores";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export { SETORES, type SetorSlug };

export class Setor {
  private constructor(private readonly props: { slug: SetorSlug }) {}

  static criar(entrada: string): Result<Setor, ValidationError> {
    if (!SETORES.includes(entrada as SetorSlug)) {
      return err(new ValidationError(`Setor inválido: ${entrada}`));
    }
    return ok(new Setor({ slug: entrada as SetorSlug }));
  }

  get slug(): SetorSlug {
    return this.props.slug;
  }
}
