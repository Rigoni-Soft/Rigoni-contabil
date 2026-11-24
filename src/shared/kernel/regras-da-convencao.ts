export const VERSAO_DO_ESQUEMA = 1;

export const CHAVES_NUMERICAS = [
  "jornada_semanal",
  "jornada_diaria",
  "limite_extras_dia",
  "intervalo_minimo",
  "intervalo_maximo",
  "extra_sabado",
] as const;
export const CHAVES_DE_REGRA = [
  ...CHAVES_NUMERICAS,
  "datas_especiais",
  "excecoes_de_feriado",
] as const;

export const CHAVES_NO_CALCULO: readonly ChaveDeRegra[] = [
  "extra_sabado",
  "limite_extras_dia",
  "datas_especiais",
];

export type ChaveNumerica = (typeof CHAVES_NUMERICAS)[number];
export type ChaveDeRegra = (typeof CHAVES_DE_REGRA)[number];

export type DataEspecial = {
  descricao: string;
  data: string | null;
  percentual: number;
  percentualComissionado?: number;
};
export type ExcecaoDeFeriado = { descricao: string };

type Citacao = { clausula: string; trecho: string };

export type RegraAplicada =
  | (Citacao & { chave: ChaveNumerica; valor: number })
  | (Citacao & { chave: "datas_especiais"; valor: DataEspecial[] })
  | (Citacao & { chave: "excecoes_de_feriado"; valor: ExcecaoDeFeriado[] });

export const MOTIVOS_DE_REJEICAO = [
  "chave_desconhecida",
  "sem_citacao",
  "valor_invalido",
  "fora_do_trecho",
  "abaixo_da_legislacao",
  "duplicada",
] as const;
export type MotivoDeRejeicao = (typeof MOTIVOS_DE_REJEICAO)[number];

export type RegraRejeitada = { chave: string; motivo: MotivoDeRejeicao };

export type RegrasDaConvencao = {
  versao: number;
  aplicadas: RegraAplicada[];
  rejeitadas: RegraRejeitada[];
};

type Unidade = "minutos" | "percentual" | "lista";

export const REFERENCIA_DA_LEGISLACAO: Record<
  ChaveDeRegra,
  { rotulo: string; unidade: Unidade; legislacao: number | null; piso?: number }
> = {
  jornada_semanal: { rotulo: "Jornada semanal", unidade: "minutos", legislacao: 44 * 60 },
  jornada_diaria: { rotulo: "Jornada diária", unidade: "minutos", legislacao: 8 * 60 },
  limite_extras_dia: {
    rotulo: "Limite de horas extras por dia",
    unidade: "minutos",
    legislacao: 120,
  },
  intervalo_minimo: { rotulo: "Intervalo mínimo", unidade: "minutos", legislacao: 60 },
  intervalo_maximo: { rotulo: "Intervalo máximo", unidade: "minutos", legislacao: 120 },
  extra_sabado: {
    rotulo: "Hora extra de sábado",
    unidade: "percentual",
    legislacao: 50,
    piso: 50,
  },
  datas_especiais: {
    rotulo: "Datas especiais",
    unidade: "lista",
    legislacao: 100,
    piso: 100,
  },
  excecoes_de_feriado: { rotulo: "Exceções de feriado", unidade: "lista", legislacao: null },
};
