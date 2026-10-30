import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { ehSetor, type SetorSlug } from "@/shared/kernel/setores";

// Módulos não se importam entre si: reusa a lista de shared/kernel, não o VO de usuarios.
export class SetorDoAtor {
  private constructor(private readonly props: { slug: SetorSlug }) {}

  static criar(entrada: string): Result<SetorDoAtor, ValidationError> {
    if (!ehSetor(entrada)) return err(new ValidationError(`Setor inválido: ${entrada}`));
    return ok(new SetorDoAtor({ slug: entrada }));
  }

  get slug(): SetorSlug {
    return this.props.slug;
  }
}
