import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export type ParcelamentoProps = {
  id: string;
  codigo: string;
  parcelasRestantes: number;
  interno: boolean;
  arquivoCaminho: string;
};

// Parcelamento digitado à mão: o mínimo de parcelas restantes é 1 (o zero só é gravado pelo sistema
// ao quitar), e o anexo é obrigatório.
export class Parcelamento {
  private constructor(private readonly props: Readonly<ParcelamentoProps>) {}

  static criar(entrada: ParcelamentoProps): Result<Parcelamento, ValidationError> {
    const codigo = entrada.codigo.trim();
    if (codigo.length < 1 || codigo.length > 60) {
      return err(new ValidationError("Código do parcelamento: de 1 a 60 caracteres."));
    }
    if (!Number.isInteger(entrada.parcelasRestantes) || entrada.parcelasRestantes < 1) {
      return err(new ValidationError("Parcelas restantes: mínimo 1."));
    }
    if (!entrada.arquivoCaminho.trim()) {
      return err(new ValidationError("Anexe o PDF do parcelamento."));
    }
    return ok(new Parcelamento({ ...entrada, codigo }));
  }

  paraGravar(): ParcelamentoProps {
    return { ...this.props };
  }
}
