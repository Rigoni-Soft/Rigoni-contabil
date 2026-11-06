import { RegistroAcaoBuilder } from "@/modules/auditoria/domain/builders/registro-acao.builder";
import type { AtorId } from "@/modules/auditoria/domain/value-objects/ator-id.vo";
import type { ResultadoAcao } from "@/modules/auditoria/domain/value-objects/resultado-acao.vo";
import type { SetorDoAtor } from "@/modules/auditoria/domain/value-objects/setor-do-ator.vo";
import type { Id } from "@/shared/kernel/id.types";

export type RegistroAcaoId = Id<"RegistroAcao">;

export type RegistroAcaoProps = {
  id: RegistroAcaoId;
  ator: AtorId;
  setor: SetorDoAtor;
  // acao e alvo ficam string: texto livre (convenção "dominio.verbo", mas o banco é text e
  // o alvo descreve qualquer entidade); a única regra é não-vazio, validada no builder.
  acao: string;
  alvo: string;
  resultado: ResultadoAcao;
  dataHora: Date;
};

export class RegistroAcao {
  private constructor(private readonly props: Readonly<RegistroAcaoProps>) {}

  static builder(): RegistroAcaoBuilder {
    return new RegistroAcaoBuilder((props) => new RegistroAcao(props));
  }

  get id(): RegistroAcaoId {
    return this.props.id;
  }

  get ator(): AtorId {
    return this.props.ator;
  }

  get setor(): SetorDoAtor {
    return this.props.setor;
  }

  get acao(): string {
    return this.props.acao;
  }

  get alvo(): string {
    return this.props.alvo;
  }

  get resultado(): ResultadoAcao {
    return this.props.resultado;
  }

  get dataHora(): Date {
    return this.props.dataHora;
  }
}
