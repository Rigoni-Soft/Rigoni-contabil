import { ValidationError } from "@/shared/errors/validation.error";
import { FORMATO_COMPETENCIA } from "@/shared/kernel/data-iso";
import { mesAtual, mesVizinho } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";

// Mês de trabalho do acompanhamento, "AAAA-MM", no fuso do escritório.
export class Competencia {
  private constructor(private readonly props: { valor: string }) {}

  static criar(entrada: string): Result<Competencia, ValidationError> {
    if (!FORMATO_COMPETENCIA.test(entrada)) {
      return err(new ValidationError("Competência inválida. Use o formato AAAA-MM."));
    }
    return ok(new Competencia({ valor: entrada }));
  }

  static atual(agora: Date): Competencia {
    return new Competencia({ valor: mesAtual(agora) });
  }

  get valor(): string {
    return this.props.valor;
  }

  // Primeiro dia do mês, como o banco guarda a competência.
  get primeiroDia(): string {
    return `${this.props.valor}-01`;
  }

  // Todos os dias do mês ("AAAA-MM-DD"): 28, 29, 30 ou 31.
  get dias(): string[] {
    const [ano, mes] = this.props.valor.split("-").map(Number);
    const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    return Array.from(
      { length: ultimo },
      (_, i) => `${this.props.valor}-${String(i + 1).padStart(2, "0")}`,
    );
  }

  // Os `quantidade` meses terminados no mês desta competência, do mais antigo ao mais novo ("AAAA-MM").
  ultimosMeses(quantidade: number): string[] {
    return Array.from({ length: quantidade }, (_, i) =>
      mesVizinho(this.props.valor, -(quantidade - 1 - i)),
    );
  }

  ehFutura(agora: Date): boolean {
    return this.props.valor > mesAtual(agora);
  }
}
