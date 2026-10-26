import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export type EstadoDaGuiaPgfn = "a_confirmar" | "confirmada";

// Guia do mês de um Parcelamento PGFN: a chave é (Parcelamento, competência AAAAMM), a mesma do
// registro de envio. A competência e a conta de negociação são digitadas (o PDF não é lido aqui).
export type GuiaParcelaPgfnProps = {
  competencia: string;
  contaNegociacao: string;
  arquivoCaminho: string;
};

const COMPETENCIA = /^\d{4}(0[1-9]|1[0-2])$/;

export function validarGuiaParcelaPgfn(
  entrada: GuiaParcelaPgfnProps,
): Result<GuiaParcelaPgfnProps, ValidationError> {
  if (!COMPETENCIA.test(entrada.competencia)) {
    return err(new ValidationError("Competência inválida: informe o mês e o ano da guia."));
  }
  const conta = entrada.contaNegociacao.trim();
  if (conta.length < 1 || conta.length > 40) {
    return err(new ValidationError("Conta de negociação: de 1 a 40 caracteres."));
  }
  return ok({ ...entrada, contaNegociacao: conta });
}
