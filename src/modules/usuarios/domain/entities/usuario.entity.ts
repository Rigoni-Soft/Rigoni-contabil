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

  // Só a troca (não o cadastro) zera isso — decisão do #31.
  precisaTrocarSenha(): boolean {
    return this.props.senhaTrocadaEm === null;
  }

  // Auth já tem a nova senha (prova gravada só DEPOIS de updateUser() ter sucesso);
  // falta apenas perfil + auditoria (PR #62, retry).
  authJaAlterado(): boolean {
    return this.precisaTrocarSenha() && this.props.senhaAuthAlteradaEm !== null;
  }

  // Soft delete (#58): o perfil continua no banco pra preservar o histórico de auditoria.
  estaDesativado(): boolean {
    return this.props.desativadoEm !== null;
  }

  // Desativada no banco (RLS já nega), mas o ban no Auth ainda não foi confirmado (PR #75, ponto D).
  bloqueioPendente(): boolean {
    return this.estaDesativado() && this.props.banidoEm === null;
  }

  senhaProvisoriaVencida(agora: Date): boolean {
    return this.precisaTrocarSenha() && agora > this.props.senhaProvisoriaExpiraEm;
  }
}
