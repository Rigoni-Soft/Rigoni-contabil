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
