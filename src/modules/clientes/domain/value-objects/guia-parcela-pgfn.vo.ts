import { ValidationError } from "@/shared/errors/validation.error";
import { normalizarCnpj } from "@/shared/kernel/cnpj";
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

// O que o leitor devolveu da guia (nulo = o PDF não traz) e o que o Funcionário digitou à mão.
export type GuiaLida = {
  cnpj: string | null;
  contaNegociacao: string | null;
  competencia: string | null;
};
export type GuiaDigitada = { competencia?: string; contaNegociacao?: string };

export type ConferenciaDaGuia = {
  competencia: string;
  contaNegociacao: string;
  // Nulo = tudo conferiu e a guia nasce confirmada; senão, o que o Funcionário deve conferir.
  motivo: string | null;
};

// Confere o PDF lido com o Parcelamento. CNPJ de outra empresa recusa o anexo; conta, competência ou
// leitura que não conferem deixam a guia "a confirmar" com o motivo. A competência é a chave da
// parcela: sem ela (nem lida, nem digitada) não há o que gravar. A conta lida é só conferência: sem
// ela vale a do Parcelamento escolhido.
export function conferirGuiaLida(
  lida: GuiaLida | null,
  parcelamento: { cnpj: string; codigo: string },
  digitada: GuiaDigitada,
): Result<ConferenciaDaGuia, ValidationError> {
  if (lida?.cnpj && normalizarCnpj(lida.cnpj) !== normalizarCnpj(parcelamento.cnpj)) {
    return err(new ValidationError("O CNPJ da guia é de outra empresa: o anexo foi recusado."));
  }
  const competencia = digitada.competencia || lida?.competencia;
  if (!competencia) {
    return err(
      new ValidationError("Não consegui ler a competência do PDF: informe o mês e o ano da guia."),
    );
  }
  const contaDigitada = digitada.contaNegociacao?.trim() || undefined;
  const contaNegociacao = contaDigitada ?? lida?.contaNegociacao ?? parcelamento.codigo;

  const motivo = !lida
    ? "Não consegui ler o PDF: confira a guia à mão."
    : !lida.cnpj
      ? "O PDF não traz o CNPJ: confira a guia à mão."
      : !lida.contaNegociacao
        ? "O PDF não traz a conta de negociação: confira a guia à mão."
        : !lida.competencia
          ? "Não consegui ler a competência do PDF: confira a guia à mão."
          : lida.contaNegociacao !== parcelamento.codigo
            ? `A conta do PDF (${lida.contaNegociacao}) é diferente da conta do Parcelamento (${parcelamento.codigo}).`
            : competencia !== lida.competencia || contaNegociacao !== lida.contaNegociacao
              ? "O que você digitou é diferente do PDF: confira a guia à mão."
              : null;
  return ok({ competencia, contaNegociacao, motivo });
}
