import type {
  RegistroAcao,
  RegistroAcaoId,
  RegistroAcaoProps,
} from "@/modules/auditoria/domain/entities/registro-acao.entity";
import { AtorId } from "@/modules/auditoria/domain/value-objects/ator-id.vo";
import { ResultadoAcao } from "@/modules/auditoria/domain/value-objects/resultado-acao.vo";
import { SetorDoAtor } from "@/modules/auditoria/domain/value-objects/setor-do-ator.vo";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export type RegistroAcaoRestaurar = {
  id: string;
  ator: string;
  setor: string;
  acao: string;
  alvo: string;
  resultado: string;
  dataHora: string;
};

export class RegistroAcaoBuilder {
  private id?: RegistroAcaoId;
  private ator?: AtorId;
  private setor?: SetorDoAtor;
  private acao?: string;
  private alvo?: string;
  private resultado?: ResultadoAcao;
  private dataHora?: Date;
  private readonly camposInvalidos: Record<string, string[]> = {};

  constructor(private readonly criar: (props: RegistroAcaoProps) => RegistroAcao) {}

  comId(id: string): this {
    this.id = id as RegistroAcaoId;
    return this;
  }

  comAtor(entrada: string): this {
    const ator = AtorId.criar(entrada);
    if (!ator.ok) {
      this.camposInvalidos.ator = [entrada.trim() ? ator.error.message : "obrigatório"];
      return this;
    }
    this.ator = ator.value;
    return this;
  }

  comSetor(entrada: string): this {
    const setor = SetorDoAtor.criar(entrada);
    if (!setor.ok) {
      this.camposInvalidos.setor = [entrada.trim() ? setor.error.message : "obrigatório"];
      return this;
    }
    this.setor = setor.value;
    return this;
  }

  comAcao(acao: string): this {
    if (!acao.trim()) this.camposInvalidos.acao = ["obrigatório"];
    this.acao = acao;
    return this;
  }

  comAlvo(alvo: string): this {
    if (!alvo.trim()) this.camposInvalidos.alvo = ["obrigatório"];
    this.alvo = alvo;
    return this;
  }

  comResultado(entrada: string): this {
    const resultado = ResultadoAcao.criar(entrada);
    if (!resultado.ok) {
      this.camposInvalidos.resultado = [resultado.error.message];
      return this;
    }
    this.resultado = resultado.value;
    return this;
  }

  comDataHora(dataHora: Date): this {
    this.dataHora = dataHora;
    return this;
  }

  restaurar(dados: RegistroAcaoRestaurar): this {
    return this.comId(dados.id)
      .comAtor(dados.ator)
      .comSetor(dados.setor)
      .comAcao(dados.acao)
      .comAlvo(dados.alvo)
      .comResultado(dados.resultado)
      .comDataHora(new Date(dados.dataHora));
  }

  build(): Result<RegistroAcao, ValidationError> {
    // Presença checada aqui, não nos setters: um setter nunca chamado não deixa
    // rastro em camposInvalidos, e os `!` abaixo mascarariam undefined em runtime.
    // O guard `!this.camposInvalidos.X` evita sobrescrever a mensagem específica
    // que o setter já registrou quando FOI chamado com um valor inválido (ex.:
    // comResultado("parcial")) — só entra quando o setter nunca rodou.
    if (!this.id) this.camposInvalidos.id = ["obrigatório"];
    if (this.ator === undefined && !this.camposInvalidos.ator)
      this.camposInvalidos.ator = ["obrigatório"];
    if (this.setor === undefined && !this.camposInvalidos.setor)
      this.camposInvalidos.setor = ["obrigatório"];
    if (this.acao === undefined && !this.camposInvalidos.acao)
      this.camposInvalidos.acao = ["obrigatório"];
    if (this.alvo === undefined && !this.camposInvalidos.alvo)
      this.camposInvalidos.alvo = ["obrigatório"];
    if (this.resultado === undefined && !this.camposInvalidos.resultado)
      this.camposInvalidos.resultado = ["obrigatório"];
    if (!this.dataHora) this.camposInvalidos.dataHora = ["obrigatório"];

    if (Object.keys(this.camposInvalidos).length > 0) {
      return err(
        new ValidationError("Dados de registro de auditoria inválidos", {
          ...this.camposInvalidos,
        }),
      );
    }

    return ok(
      this.criar({
        id: this.id!,
        ator: this.ator!,
        setor: this.setor!,
        acao: this.acao!,
        alvo: this.alvo!,
        resultado: this.resultado!,
        dataHora: this.dataHora!,
      }),
    );
  }
}
