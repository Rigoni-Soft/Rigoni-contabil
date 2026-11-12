import type { Jornada, Totalizacao } from "@/modules/rh/domain/services/totalizacao.service";

export type TotalizacaoDto = Totalizacao;

// Minutos de 0 a 1439 desde 00:00; saída menor que a entrada = a jornada virou o dia.
export type ParDto = { entrada: number; saida: number };

export type EmpregadoDto = {
  id: string;
  nome: string;
  // Carga em minutos por dia da semana, de domingo a sábado.
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
  // 0 = domingo.
  diaDaSemana: number;
  feriado: boolean;
  // Carga do dia pela Jornada do empregado.
  cargaMin: number;
  // H. Diária: o que foi batido no dia.
  trabalhadoMin: number;
  // O cálculo do dia (atrasos, extras por faixa, adicional noturno, falta, abono), pela convenção da data.
  apuracao: TotalizacaoDto;
};

export type EmpregadoDaFolhaDto = EmpregadoDto & { semMovimento: boolean };

export type FolhaDePontoDto = {
  clienteId: string;
  empresa: string;
  competencia: string;
  // Padrão do Cliente: os empregados novos já nascem comissionados.
  padraoComissionados: boolean;
  empregados: EmpregadoDaFolhaDto[];
  // Só o Responsável do RH do Cliente edita; o Líder e o Admin leem.
  podeEditar: boolean;
  // Cartão e Totalização do empregado escolhido (só quando o empregado é pedido).
  selecionado: {
    empregado: EmpregadoDaFolhaDto;
    dias: DiaDaFolhaDto[];
    totalizacao: TotalizacaoDto;
    // O cartão do mês já foi salvo ao menos uma vez (mesmo sem horário): os dias úteis vazios são falta.
    iniciado: boolean;
    // Algum dia do mês sem convenção vigente: a Totalização desses dias é pela legislação.
    semConvencao: boolean;
  } | null;
};
