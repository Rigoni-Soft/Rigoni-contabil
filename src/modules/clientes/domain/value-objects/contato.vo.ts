import { Email } from "@/modules/clientes/domain/value-objects/email.vo";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { telefoneAceito } from "@/shared/kernel/telefone";

export type ContatoProps = {
  id?: string;
  nome: string;
  telefone: string;
  email: string;
  donoSetor?: string | null;
  setores?: readonly string[];
  telefoneOriginal?: string;
};

export type ContatoEditavel = Pick<ContatoProps, "id" | "nome" | "telefone" | "email">;

export class Contato {
  private constructor(private readonly props: ContatoProps) {}

  static criar(entrada: ContatoProps): Result<Contato, ValidationError> {
    const nome = entrada.nome.trim();
    const telefone = entrada.telefone.trim();
    const email = entrada.email.trim().toLowerCase();
    if (!nome) return err(new ValidationError("Nome do contato é obrigatório"));
    if (!telefone && !email) {
      return err(new ValidationError("Informe o WhatsApp ou o e-mail do contato"));
    }
    if (telefone && !telefoneAceito(telefone, entrada.telefoneOriginal)) {
      return err(new ValidationError("Informe o WhatsApp com DDD"));
    }
    if (email && !Email.criar(email).ok) return err(new ValidationError("e-mail inválido"));
    return ok(new Contato({ ...entrada, nome, telefone, email }));
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

  get email(): string {
    return this.props.email;
  }

  get donoSetor(): string | null | undefined {
    return this.props.donoSetor;
  }

  get setores(): readonly string[] {
    return this.props.setores ?? [];
  }
}
