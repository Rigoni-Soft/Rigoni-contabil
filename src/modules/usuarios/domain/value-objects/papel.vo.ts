import { ValidationError } from "@/shared/errors/validation.error";
import { PAPEIS, type Papel as PapelValor } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

export { PAPEIS, type PapelValor };

export class Papel {
  private constructor(private readonly props: { valor: PapelValor }) {}

  static criar(entrada: string): Result<Papel, ValidationError> {
    if (!PAPEIS.includes(entrada as PapelValor)) {
      return err(new ValidationError(`Papel inválido: ${entrada}`));
    }
    return ok(new Papel({ valor: entrada as PapelValor }));
  }

  get valor(): PapelValor {
    return this.props.valor;
  }

  ehAdmin(): boolean {
    return this.props.valor === "admin";
  }

  ehLiderSetor(): boolean {
    return this.props.valor === "lider_setor";
  }
}
