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
  senhaTrocadaEm: Date | null;
  senhaAuthAlteradaEm: Date | null;
  senhaProvisoriaExpiraEm: Date;
  desativadoEm: Date | null;
  // Quando o Auth confirmou o ban da conta desativada; null + desativadoEm = bloqueio pendente.
  banidoEm: Date | null;
  // Quando a foto do avatar foi gravada (ADR 0012); null = sem foto.
  avatarAtualizadoEm: Date | null;
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

  // Só a troca (não o cadastro) zera isso.
  precisaTrocarSenha(): boolean {
    return this.props.senhaTrocadaEm === null;
  }

  // Auth já tem a nova senha (prova gravada só DEPOIS de updateUser() ter sucesso);
  // falta apenas perfil + auditoria.
  authJaAlterado(): boolean {
    return this.precisaTrocarSenha() && this.props.senhaAuthAlteradaEm !== null;
  }

  // Soft delete: o perfil continua no banco pra preservar o histórico de auditoria.
  estaDesativado(): boolean {
    return this.props.desativadoEm !== null;
  }

  // Desativada no banco (RLS já nega), mas o ban no Auth ainda não foi confirmado.
  bloqueioPendente(): boolean {
    return this.estaDesativado() && this.props.banidoEm === null;
  }

  get avatarAtualizadoEm(): Date | null {
    return this.props.avatarAtualizadoEm;
  }

  temAvatar(): boolean {
    return this.props.avatarAtualizadoEm !== null;
  }

  // Só o Funcionário personaliza o avatar (ADR 0012); Líder e Admin ficam com a logo.
  podePersonalizarAvatar(): boolean {
    return this.props.papel.valor === "funcionario";
  }

  senhaProvisoriaVencida(agora: Date): boolean {
    return this.precisaTrocarSenha() && agora > this.props.senhaProvisoriaExpiraEm;
  }
}
