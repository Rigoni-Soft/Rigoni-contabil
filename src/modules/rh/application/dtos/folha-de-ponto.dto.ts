import type { Jornada, Totalizacao } from "@/modules/rh/domain/services/totalizacao.service";

export type TotalizacaoDto = Totalizacao;

export type ParDto = { entrada: number; saida: number };

export type EmpregadoDto = {
  id: string;
  nome: string;
  jornada: Jornada;
  comissionado: boolean;
  ativo: boolean;
};

export type DiaDoPontoDto = {
  data: string;
  batidas: ParDto[];
  extra: ParDto | null;
  abono: boolean;
};

export type DiaDaFolhaDto = DiaDoPontoDto & {
  diaDaSemana: number;
  feriado: boolean;
  cargaMin: number;
  diaDeTrabalho: boolean;
  trabalhadoMin: number;
  apuracao: TotalizacaoDto;
};

export type EmpregadoDaFolhaDto = EmpregadoDto & { semMovimento: boolean };

export type FolhaDePontoDto = {
  clienteId: string;
  empresa: string;
  competencia: string;
  padraoComissionados: boolean;
  empregados: EmpregadoDaFolhaDto[];
  podeEditar: boolean;
  selecionado: {
    empregado: EmpregadoDaFolhaDto;
    dias: DiaDaFolhaDto[];
    totalizacao: TotalizacaoDto;
    iniciado: boolean;
    semConvencao: boolean;
    motivoSemPdf?: string;
  } | null;
};
