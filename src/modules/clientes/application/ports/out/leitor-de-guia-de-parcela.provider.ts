// Contrato neutro (ADR 0004): recebe os bytes do PDF da guia do mês e devolve o que leu. Nada de
// provedor, modelo ou token aqui. Nunca rejeita: falha, modelo desconhecido ou PDF escaneado viram
// `{ lido: false }`. Cada dado é nulo quando o PDF não o traz; só a competência (AAAAMM) vira dado
// gravado, o resto (CNPJ, conta, vencimento, valor) só confere ou informa.
export type LeituraDeGuia =
  | {
      lido: true;
      cnpj: string | null;
      contaNegociacao: string | null;
      competencia: string | null;
      vencimento: string | null;
      valorCentavos: number | null;
    }
  | { lido: false };

export interface LeitorDeGuiaDeParcelaPort {
  ler(pdf: Uint8Array): Promise<LeituraDeGuia>;
}
