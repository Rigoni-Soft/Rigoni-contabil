import { ValidationError } from "@/shared/errors/validation.error";
import { mesAtual } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";

const FORMATO = /^\d{4}-(0[1-9]|1[0-2])$/;

// Mês de trabalho do acompanhamento, "AAAA-MM", no fuso do escritório.
export class Competencia {
  private constructor(private readonly props: { valor: string }) {}

  static criar(entrada: string): Result<Competencia, ValidationError> {
    if (!FORMATO.test(entrada)) {
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

  // Os `quantidade` meses terminados no mês desta competência, do mais antigo ao mais novo ("AAAA-MM").
  ultimosMeses(quantidade: number): string[] {
    const [ano, mes] = this.props.valor.split("-").map(Number);
    return Array.from({ length: quantidade }, (_, i) => {
      const d = new Date(Date.UTC(ano, mes - 1 - (quantidade - 1 - i), 1));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    });
  }

  ehFutura(agora: Date): boolean {
    return this.props.valor > mesAtual(agora);
  }
}
