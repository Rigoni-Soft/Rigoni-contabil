export type SituacaoDoDiaNoDocumento = "Abono" | "Falta" | "Feriado" | "Folga" | "";

export type LinhaDoDocumentoDto = {
  data: string;
  diaDaSemana: string;
  batidas: [string, string, string, string];
  extra: string;
  horasDiarias: string;
  situacao: SituacaoDoDiaNoDocumento;
};

export type ItemDoDocumentoDto = { rotulo: string; valor: string };

export type DocumentoDoCartaoDto = {
  empresa: string;
  empregado: string;
  periodo: string;
  linhas: LinhaDoDocumentoDto[];
  totalizacao: ItemDoDocumentoDto[];
  avisoDaTotalizacao?: string;
};

export type PdfDoCartaoDto = {
  nomeDoArquivo: string;
  bytes: Uint8Array;
};
