import { ok, type Result } from "@/shared/kernel/result";

export type AtividadeMensalProps = {
  anoMes: string;
  industria: boolean;
  comercio: boolean;
  servico: boolean;
};

// Registro mensal do Cliente (CONTEXT.md, termo "Atividade do mês"): 3 flags
// independentes, não mutuamente exclusivas — sem regra de validação além do
// shape, por isso `criar` nunca falha (Result<_, never>).
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
