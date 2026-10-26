// Contrato neutro (ADR 0004): recebe os bytes do PDF do acordo e devolve o que leu. Nada de
// provedor, modelo ou token aqui. Nunca rejeita: falha vira `{ lido: false }`.
import type {
  DadosDoAcordo,
  MotivoDeLeituraFalha,
} from "@/modules/clientes/domain/value-objects/parcelamento.vo";

export type LeituraDeParcelamento =
  // `codigo` nulo: o PDF não traz código (ex.: Recibo de Adesão da Receita); o caso de uso gera um
  // interno. `cnpj` é o do contribuinte no PDF (só para conferir com o do Cliente, não se grava).
  // Cada dado do acordo é nulo quando o PDF não o traz.
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
