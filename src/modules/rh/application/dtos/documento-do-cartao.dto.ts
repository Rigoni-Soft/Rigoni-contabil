// O que o PDF do Cartão de ponto traz, já em texto: o gerador só desenha, não calcula nada.
export type LinhaDoDocumentoDto = {
  // "dd/mm".
  data: string;
  diaDaSemana: string;
  // Entrada 1, saída 1, entrada 2, saída 2 ("" = sem batida).
  batidas: [string, string, string, string];
  // "HH:MM-HH:MM" da coluna Extra, ou "".
  extra: string;
  // H. Diária, como "8h45".
  horasDiarias: string;
  // "Abono", "Falta", "Feriado", "Folga" ou "".
  situacao: string;
};

export type ItemDoDocumentoDto = { rotulo: string; valor: string };

export type DocumentoDoCartaoDto = {
  empresa: string;
  empregado: string;
  // "MM/AAAA".
  periodo: string;
  linhas: LinhaDoDocumentoDto[];
  // A Totalização do mês, em destaque no PDF.
  totalizacao: ItemDoDocumentoDto[];
  // Aviso de que parte do mês foi totalizada pela legislação, por falta de convenção vigente.
  avisoDaTotalizacao?: string;
};

export type PdfDoCartaoDto = {
  nomeDoArquivo: string;
  bytes: Uint8Array;
};
