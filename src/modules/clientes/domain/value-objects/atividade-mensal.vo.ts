import { ok, type Result } from "@/shared/kernel/result";

export type AtividadeMensalProps = {
  anoMes: string;
  industria: boolean;
  comercio: boolean;
  servico: boolean;
};

export class AtividadeMensal {
  private constructor(private readonly props: AtividadeMensalProps) {}

  static criar(entrada: AtividadeMensalProps): Result<AtividadeMensal, never> {
    return ok(new AtividadeMensal({ ...entrada }));
  }

  get anoMes(): string {
    return this.props.anoMes;
  }

  get industria(): boolean {
    return this.props.industria;
  }

  get comercio(): boolean {
    return this.props.comercio;
  }

  get servico(): boolean {
    return this.props.servico;
  }
}
