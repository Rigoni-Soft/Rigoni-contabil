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
export function validarParcelamento(
  entrada: ParcelamentoProps,
): Result<ParcelamentoProps, ValidationError> {
  const codigo = entrada.codigo.trim();
  if (codigo.length < 1 || codigo.length > 60) {
    return err(new ValidationError("Código do parcelamento: de 1 a 60 caracteres."));
  }
  if (!Number.isInteger(entrada.parcelasRestantes) || entrada.parcelasRestantes < 1) {
    return err(new ValidationError("Informe pelo menos 1 parcela restante."));
  }
  if (!entrada.arquivoCaminho.trim()) {
    return err(new ValidationError("Anexe o PDF do parcelamento."));
  }
  return ok({ ...entrada, codigo });
}
