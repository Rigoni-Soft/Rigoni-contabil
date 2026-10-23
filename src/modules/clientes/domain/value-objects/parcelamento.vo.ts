import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export const ORIGENS_DO_PARCELAMENTO = ["receita_federal", "pgfn"] as const;
export type OrigemDoParcelamento = (typeof ORIGENS_DO_PARCELAMENTO)[number];

// Dados do acordo lidos do PDF e gravados com o Parcelamento (informativos: conferem o valor da guia,
// dizem de qual órgão é e quando aderiu). Cada um é nulo quando o PDF não traz ou veio inválido.
export type DadosDoAcordo = {
  origem: OrigemDoParcelamento | null;
  totalDeParcelas: number | null;
  valorDaParcelaCentavos: number | null;
  dataDeAdesao: string | null; // AAAA-MM-DD
};

// Entrada vinda do leitor ou do formulário: não se confia no formato, cada campo inválido vira nulo.
export function normalizarAcordo(bruto: {
  origem?: unknown;
  totalDeParcelas?: unknown;
  valorDaParcelaCentavos?: unknown;
  dataDeAdesao?: unknown;
}): DadosDoAcordo {
  const inteiroPositivo = (v: unknown) =>
    Number.isInteger(v) && (v as number) >= 1 ? (v as number) : null;
  const data = typeof bruto.dataDeAdesao === "string" ? bruto.dataDeAdesao : "";
  const instante = new Date(`${data}T00:00:00Z`);
  const dataValida =
    /^\d{4}-\d{2}-\d{2}$/.test(data) &&
    !Number.isNaN(instante.getTime()) &&
    instante.toISOString().startsWith(data);
  return {
    origem: ORIGENS_DO_PARCELAMENTO.find((o) => o === bruto.origem) ?? null,
    totalDeParcelas: inteiroPositivo(bruto.totalDeParcelas),
    valorDaParcelaCentavos: inteiroPositivo(bruto.valorDaParcelaCentavos),
    dataDeAdesao: dataValida ? data : null,
  };
}

export type ParcelamentoProps = {
  id: string;
  codigo: string;
  parcelasRestantes: number;
  interno: boolean;
  arquivoCaminho: string;
  acordo?: DadosDoAcordo;
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
  return ok({
    ...entrada,
    codigo,
    ...(entrada.acordo && { acordo: normalizarAcordo(entrada.acordo) }),
  });
}

export type MotivoDeLeituraFalha = "ilegivel" | "indisponivel" | "limite" | "recusado";

export type SugestaoLida =
  | {
      lido: true;
      codigo: string;
      codigoGerado: boolean;
      quantidadeDeParcelas: number;
      acordo: DadosDoAcordo;
    }
  | { lido: false; motivo: MotivoDeLeituraFalha };

// Validação final do que o leitor devolveu (o leitor só sugere): quantidade inteira >= 1, senão a
// leitura não vale. PDF sem código (ou com código longo demais) recebe um interno; o Serpro emite a
// guia só pela parcela, então o código serve de rótulo e pode ser trocado na tela.
export function sugerirParcelamento(
  leitura:
    | ({ lido: true; codigo: string | null; quantidadeDeParcelas: number } & Parameters<
        typeof normalizarAcordo
      >[0])
    | { lido: false; motivo: MotivoDeLeituraFalha },
): SugestaoLida {
  if (!leitura.lido) return leitura;
  if (!Number.isInteger(leitura.quantidadeDeParcelas) || leitura.quantidadeDeParcelas < 1) {
    return { lido: false, motivo: "ilegivel" };
  }
  const lido = leitura.codigo?.trim() ?? "";
  const valido = lido.length >= 1 && lido.length <= 60;
  return {
    lido: true,
    codigo: valido ? lido : `PARC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    codigoGerado: !valido,
    quantidadeDeParcelas: leitura.quantidadeDeParcelas,
    acordo: normalizarAcordo(leitura),
  };
}
