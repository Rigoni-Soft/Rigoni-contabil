import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Organograma real, exceto Patriki (raiz) e Expedição. Presumido/Real -> Tributário.
// Zeladoria (subtime de Financeiro) não vira setor próprio de login nesta rodada.
export const SETORES = [
  "rh",
  "tributario",
  "simples_nacional",
  "contabil",
  "societario",
  "condominios",
  "financeiro",
  "administrativo",
  "contabil_externo",
  "ti",
  "recepcao",
] as const;
export type SetorSlug = (typeof SETORES)[number];

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
