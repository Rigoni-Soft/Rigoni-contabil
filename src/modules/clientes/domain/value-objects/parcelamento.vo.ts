import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export const ORIGENS_DO_PARCELAMENTO = ["receita_federal", "pgfn"] as const;
export type OrigemDoParcelamento = (typeof ORIGENS_DO_PARCELAMENTO)[number];

export type DadosDoAcordo = {
  origem: OrigemDoParcelamento | null;
  totalDeParcelas: number | null;
  valorDaParcelaCentavos: number | null;
  dataDeAdesao: string | null;
};

type AcordoBruto = { [K in keyof DadosDoAcordo]?: unknown };

export function normalizarAcordo(bruto: AcordoBruto): DadosDoAcordo {
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

export const gerarCodigoDeParcelamento = () =>
  `PARC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

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

export function sugerirParcelamento(
  leitura:
    | ({ lido: true; codigo: string | null; quantidadeDeParcelas: number } & AcordoBruto)
    | { lido: false; motivo: MotivoDeLeituraFalha },
): SugestaoLida {
  if (!leitura.lido) return leitura;
  if (!Number.isInteger(leitura.quantidadeDeParcelas) || leitura.quantidadeDeParcelas < 1) {
    return { lido: false, motivo: "ilegivel" };
  }
  const lido = leitura.codigo?.trim() ?? "";
  if (lido.length > 60) return { lido: false, motivo: "ilegivel" };
  return {
    lido: true,
    codigo: lido || gerarCodigoDeParcelamento(),
    codigoGerado: !lido,
    quantidadeDeParcelas: leitura.quantidadeDeParcelas,
    acordo: normalizarAcordo(leitura),
  };
}
