import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export type ContatoProps = { id?: string; nome: string; telefone: string; padrao: boolean };

export class Contato {
  private constructor(
    private readonly props: { id?: string; nome: string; telefone: string; padrao: boolean },
  ) {}

  static criar(entrada: ContatoProps): Result<Contato, ValidationError> {
    if (!entrada.nome.trim()) return err(new ValidationError("Nome do contato é obrigatório"));
    if (!entrada.telefone.trim())
      return err(new ValidationError("Telefone do contato é obrigatório"));
    return ok(new Contato({ ...entrada }));
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get nome(): string {
    return this.props.nome;
  }

  get telefone(): string {
    return this.props.telefone;
  }

  get padrao(): boolean {
    return this.props.padrao;
  }
}
