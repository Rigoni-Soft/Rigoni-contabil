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
};

export class UsuarioBuilder {
  private id?: UsuarioId;
  private nome?: string;
  private email?: string;
  private papel?: Papel;
  private setor?: Setor;
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

  restaurar(dados: UsuarioRestaurar): this {
    return this.comId(dados.id)
      .comNome(dados.nome)
      .comEmail(dados.email)
      .comPapel(dados.papel)
      .comSetor(dados.setor);
  }

  build(): Result<Usuario, ValidationError> {
    if (!this.id) this.camposInvalidos.id = ["obrigatório"];

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
      }),
    );
  }
}
