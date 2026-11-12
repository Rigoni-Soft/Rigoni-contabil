// Esquema fechado dos parâmetros que a Convenção coletiva pode mudar em relação à legislação padrão. Fora
// daqui, o modelo de linguagem não cria regra: o que não couber vira "não aplicada" e vale a legislação.
// Tudo em minutos ou em percentual; datas como "DD/MM".

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

// As chaves que mudam o cálculo da Totalização (regras-de-calculo.service). As outras são extraídas e mostradas,
// mas o motor não as usa: jornada e intervalos vêm do empregado e das batidas, e a exceção de feriado não tem data
// para casar. Um teste do serviço trava esta lista contra o que `regrasDeCalculo` realmente lê.
export const CHAVES_NO_CALCULO: readonly ChaveDeRegra[] = [
  "extra_sabado",
  "limite_extras_dia",
  "datas_especiais",
];

export type ChaveNumerica = (typeof CHAVES_NUMERICAS)[number];
export type ChaveDeRegra = (typeof CHAVES_DE_REGRA)[number];

export type DataEspecial = {
  descricao: string;
  // "DD/MM"; nulo para data móvel (Carnaval), que o RH marca no cartão.
  data: string | null;
  percentual: number;
  // Percentual do comissionado quando a convenção traz um diferente (75% x 50%); ausente = o mesmo.
  percentualComissionado?: number;
};
export type ExcecaoDeFeriado = { descricao: string };

export type Citacao = { clausula: string; trecho: string };

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

// O conjunto gravado por convenção. `versao` é a do esquema: um esquema novo não reinterpreta o antigo.
export type RegrasDaConvencao = {
  versao: number;
  aplicadas: RegraAplicada[];
  rejeitadas: RegraRejeitada[];
};

type Unidade = "minutos" | "percentual" | "lista";

// A legislação padrão que cada parâmetro substitui, para a tela mostrar a diferença. Em minutos ou %.
// `piso`: percentual abaixo disso é rejeitado (a convenção não pode pagar menos que a lei).
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
