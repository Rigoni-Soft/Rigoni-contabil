import type { Totalizacao } from "@/modules/rh/domain/services/totalizacao.service";

export type TotalizacaoDto = Totalizacao;

// Minutos de 0 a 1439 desde 00:00; saída menor que a entrada = a jornada virou o dia.
export type ParDto = { entrada: number; saida: number };

export type EmpregadoDto = {
  id: string;
  nome: string;
  // Carga em minutos por dia da semana, de domingo a sábado.
  jornada: number[];
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
  // 0 = domingo.
  diaDaSemana: number;
  feriado: boolean;
  // Carga do dia pela Jornada do empregado.
  cargaMin: number;
};

export type EmpregadoDaFolhaDto = EmpregadoDto & { semMovimento: boolean };

export type FolhaDePontoDto = {
  clienteId: string;
  competencia: string;
  quinzena: 1 | 2;
  // Padrão do Cliente: os empregados novos já nascem comissionados.
  padraoComissionados: boolean;
  empregados: EmpregadoDaFolhaDto[];
  // Só o Responsável do RH do Cliente edita; o Líder e o Admin leem.
  podeEditar: boolean;
  // Cartão e Totalização do empregado escolhido (o primeiro ativo, se nenhum for pedido).
  selecionado: {
    empregado: EmpregadoDaFolhaDto;
    dias: DiaDaFolhaDto[];
    totalizacao: TotalizacaoDto;
  } | null;
};
