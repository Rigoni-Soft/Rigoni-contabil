import type {
  RegistroAcao,
  RegistroAcaoId,
  RegistroAcaoProps,
} from "@/modules/auditoria/domain/entities/registro-acao.entity";
import { ResultadoAcao } from "@/modules/auditoria/domain/value-objects/resultado-acao.vo";
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
  private ator?: string;
  private setor?: string;
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

  comAtor(ator: string): this {
    if (!ator.trim()) this.camposInvalidos.ator = ["obrigatório"];
    this.ator = ator;
    return this;
  }

  comSetor(setor: string): this {
    if (!setor.trim()) this.camposInvalidos.setor = ["obrigatório"];
    this.setor = setor;
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
    if (!this.id) this.camposInvalidos.id = ["obrigatório"];
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
