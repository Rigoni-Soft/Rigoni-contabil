// Contrato neutro (ADR 0004): recebe os bytes do PDF do acordo e devolve o que leu. Nada de
// provedor, modelo ou token aqui. Nunca rejeita: falha vira `{ lido: false }`.
import type { MotivoDeLeituraFalha } from "@/modules/clientes/domain/value-objects/parcelamento.vo";

export type LeituraDeParcelamento =
  // `codigo` nulo: o PDF não traz código (ex.: Recibo de Adesão); o caso de uso gera um interno.
  | { lido: true; codigo: string | null; quantidadeDeParcelas: number }
  | { lido: false; motivo: MotivoDeLeituraFalha };

export interface LeitorDeParcelamentoPort {
  ler(pdf: Uint8Array): Promise<LeituraDeParcelamento>;
}
