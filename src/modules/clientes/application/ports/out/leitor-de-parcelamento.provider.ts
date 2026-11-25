import type {
  DadosDoAcordo,
  MotivoDeLeituraFalha,
} from "@/modules/clientes/domain/value-objects/parcelamento.vo";

export type LeituraDeParcelamento =
  | ({
      lido: true;
      codigo: string | null;
      quantidadeDeParcelas: number;
      cnpj: string | null;
    } & DadosDoAcordo)
  | { lido: false; motivo: MotivoDeLeituraFalha };

export interface LeitorDeParcelamentoPort {
  ler(pdf: Uint8Array): Promise<LeituraDeParcelamento>;
}
