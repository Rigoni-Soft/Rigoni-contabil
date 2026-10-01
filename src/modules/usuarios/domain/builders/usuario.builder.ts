import type {
  Usuario,
  UsuarioId,
  UsuarioProps,
} from "@/modules/usuarios/domain/entities/usuario.entity";
import { Papel } from "@/modules/usuarios/domain/value-objects/papel.vo";
import { Setor } from "@/modules/usuarios/domain/value-objects/setor.vo";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export type UsuarioRestaurar = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  setor: string;
  senhaTrocadaEm: string | null;
  senhaTrocaIniciadaEm?: string | null;
  senhaProvisoriaExpiraEm: string;
};

const HORAS_VALIDADE_SENHA_PROVISORIA = 48;

export class UsuarioBuilder {
  private id?: UsuarioId;
  private nome?: string;
  private email?: string;
  private papel?: Papel;
  private setor?: Setor;
  private senhaTrocadaEm: Date | null = null;
  private senhaTrocaIniciadaEm: Date | null = null;
  private senhaProvisoriaExpiraEm?: Date;
  private readonly camposInvalidos: Record<string, string[]> = {};

  constructor(private readonly criar: (props: UsuarioProps) => Usuario) {}

  comId(id: string): this {
    this.id = id as UsuarioId;
    return this;
  }

  comNome(nome: string): this {
    if (!nome.trim()) this.camposInvalidos.nome = ["obrigatório"];
    this.nome = nome;
    return this;
  }

  comEmail(email: string): this {
    if (!email.includes("@")) this.camposInvalidos.email = ["formato inválido"];
    this.email = email;
    return this;
  }

  comPapel(entrada: string): this {
    const resultado = Papel.criar(entrada);
    if (resultado.ok) this.papel = resultado.value;
    else this.camposInvalidos.papel = [resultado.error.message];
    return this;
  }

  comSetor(entrada: string): this {
    const resultado = Setor.criar(entrada);
    if (resultado.ok) this.setor = resultado.value;
    else this.camposInvalidos.setor = [resultado.error.message];
    return this;
  }

  comSenhaTrocadaEm(data: string | null): this {
    this.senhaTrocadaEm = data ? new Date(data) : null;
    return this;
  }

  comSenhaTrocaIniciadaEm(data: string | null): this {
    this.senhaTrocaIniciadaEm = data ? new Date(data) : null;
    return this;
  }

  comSenhaProvisoriaExpiraEm(data: string): this {
    this.senhaProvisoriaExpiraEm = new Date(data);
    return this;
  }

  restaurar(dados: UsuarioRestaurar): this {
    return this.comId(dados.id)
      .comNome(dados.nome)
      .comEmail(dados.email)
      .comPapel(dados.papel)
      .comSetor(dados.setor)
      .comSenhaTrocadaEm(dados.senhaTrocadaEm)
      .comSenhaTrocaIniciadaEm(dados.senhaTrocaIniciadaEm ?? null)
      .comSenhaProvisoriaExpiraEm(dados.senhaProvisoriaExpiraEm);
  }

  build(): Result<Usuario, ValidationError> {
    // Presença checada aqui, não nos setters: um setter nunca chamado não deixa
    // rastro em camposInvalidos, e os `!` abaixo mascarariam undefined em runtime
    // (devolutiva #55, ponto 03 — builder aceitava usuário incompleto). O guard
    // `!this.camposInvalidos.X` evita sobrescrever a mensagem específica que o
    // setter já registrou quando FOI chamado com um valor inválido (ex.:
    // comPapel("gerente")) — só entra quando o setter nunca rodou.
    if (!this.id) this.camposInvalidos.id = ["obrigatório"];
    if (this.nome === undefined) this.camposInvalidos.nome = ["obrigatório"];
    if (this.email === undefined) this.camposInvalidos.email = ["obrigatório"];
    if (this.papel === undefined && !this.camposInvalidos.papel)
      this.camposInvalidos.papel = ["obrigatório"];
    if (this.setor === undefined && !this.camposInvalidos.setor)
      this.camposInvalidos.setor = ["obrigatório"];

    if (Object.keys(this.camposInvalidos).length > 0) {
      return err(new ValidationError("Dados de usuário inválidos", { ...this.camposInvalidos }));
    }

    return ok(
      this.criar({
        id: this.id!,
        nome: this.nome!,
        email: this.email!,
        papel: this.papel!,
        setor: this.setor!,
        senhaTrocadaEm: this.senhaTrocadaEm,
        senhaTrocaIniciadaEm: this.senhaTrocaIniciadaEm,
        // Cadastro novo (#30) não chama comSenhaProvisoriaExpiraEm: default aqui
        // espelha o default da coluna na migration do #31.
        senhaProvisoriaExpiraEm:
          this.senhaProvisoriaExpiraEm ??
          new Date(Date.now() + HORAS_VALIDADE_SENHA_PROVISORIA * 60 * 60 * 1000),
      }),
    );
  }
}
