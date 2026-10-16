import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// "falha_compensacao": a própria compensação/rollback falhou — conta pode ter
// ficado órfã, distinto de uma falha comum.
export const RESULTADOS_ACAO = ["sucesso", "falha", "falha_compensacao"] as const;
export type ResultadoAcaoValor = (typeof RESULTADOS_ACAO)[number];

export class ResultadoAcao {
  private constructor(private readonly props: { valor: ResultadoAcaoValor }) {}

  static criar(entrada: string): Result<ResultadoAcao, ValidationError> {
    if (!RESULTADOS_ACAO.includes(entrada as ResultadoAcaoValor)) {
      return err(new ValidationError(`Resultado de ação inválido: ${entrada}`));
    }
    return ok(new ResultadoAcao({ valor: entrada as ResultadoAcaoValor }));
  }

  get valor(): ResultadoAcaoValor {
    return this.props.valor;
  }
}
