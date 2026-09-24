import { UsuarioBuilder } from "@/modules/usuarios/domain/builders/usuario.builder";
import type { Papel } from "@/modules/usuarios/domain/value-objects/papel.vo";
import type { Setor } from "@/modules/usuarios/domain/value-objects/setor.vo";
import type { Id } from "@/shared/kernel/id.types";

export type UsuarioId = Id<"Usuario">;

export type UsuarioProps = {
  id: UsuarioId;
  nome: string;
  email: string;
  papel: Papel;
  setor: Setor;
};

export class Usuario {
  private constructor(private readonly props: Readonly<UsuarioProps>) {}

  static builder(): UsuarioBuilder {
    return new UsuarioBuilder((props) => new Usuario(props));
  }

  get id(): UsuarioId {
    return this.props.id;
  }

  get nome(): string {
    return this.props.nome;
  }

  get email(): string {
    return this.props.email;
  }

  get papel(): Papel {
    return this.props.papel;
  }

  get setor(): Setor {
    return this.props.setor;
  }
}
