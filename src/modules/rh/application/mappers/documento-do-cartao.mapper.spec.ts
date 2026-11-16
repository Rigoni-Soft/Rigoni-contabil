import type {
  DiaDaFolhaDto,
  FolhaDePontoDto,
} from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import { documentoDoCartao } from "@/modules/rh/application/mappers/documento-do-cartao.mapper";

type Cartao = NonNullable<FolhaDePontoDto["selecionado"]>;

const ZERO = {
  normaisMin: 0,
  extras: [],
  bancoDeHorasMin: 0,
  acimaDoLimiteMin: 0,
  noturnoMin: 0,
  atrasoMin: 0,
  faltas: 0,
  abonoDias: 0,
  abonoMin: 0,
  feriadosTrabalhados: 0,
  sabadosTrabalhados: 0,
  diasComLanche: 0,
};

const dia = (data: string, semana: number, extras: Partial<DiaDaFolhaDto> = {}): DiaDaFolhaDto => ({
  data,
  batidas: [],
  extra: null,
  abono: false,
  feriado: false,
  temApontamento: !!extras.batidas?.length || !!extras.extra || !!extras.abono,
  diaDaSemana: semana,
  cargaMin: 525,
  diaDeTrabalho: true,
  trabalhadoMin: 0,
  apuracao: ZERO,
  ...extras,
});

function folha(cartao: Partial<Cartao>, dias: DiaDaFolhaDto[]): [FolhaDePontoDto, Cartao] {
  const selecionado: Cartao = {
    empregado: {
      id: "e1",
      nome: "Ana",
      jornada: [0, 525, 525, 525, 525, 525, 240],
      comissionado: false,
      ativo: true,
      semMovimento: false,
    },
    dias,
    totalizacao: ZERO,
    iniciado: true,
    semConvencao: false,
    ...cartao,
  };
  return [
    {
      clienteId: "c1",
      empresa: "Teste Ltda",
      competencia: "2026-11",
      padraoComissionados: false,
      empregados: [],
      podeEditar: true,
      selecionado,
    },
    selecionado,
  ];
}

describe("documentoDoCartao", () => {
  it("traz empresa, empregado e o período como MM/AAAA", () => {
    const documento = documentoDoCartao(...folha({}, []));

    expect(documento).toMatchObject({
      empresa: "Teste Ltda",
      empregado: "Ana",
      periodo: "11/2026",
      avisoDaTotalizacao: undefined,
    });
  });

  it("classifica o dia: abono, falta, feriado e folga; dia comum fica sem situação", () => {
    const dias = [
      dia("2026-11-02", 1, { trabalhadoMin: 60 }),
      dia("2026-11-03", 2, { abono: true }),
      dia("2026-11-04", 3, { apuracao: { ...ZERO, faltas: 1 } }),
      dia("2026-11-15", 0, { feriado: true, diaDeTrabalho: false }),
      dia("2026-11-08", 0, { cargaMin: 0, diaDeTrabalho: false }),
    ];

    const { linhas } = documentoDoCartao(...folha({}, dias));

    expect(linhas.map((l) => l.situacao)).toEqual(["", "Abono", "Falta", "Feriado", "Folga"]);
  });

  it("formata data, batidas e Extra do dia", () => {
    const dias = [
      dia("2026-11-02", 1, {
        batidas: [{ entrada: 480, saida: 720 }],
        extra: { entrada: 1140, saida: 1200 },
        trabalhadoMin: 300,
      }),
    ];

    const [linha] = documentoDoCartao(...folha({}, dias)).linhas;

    expect(linha).toMatchObject({
      data: "02/11",
      diaDaSemana: "seg",
      batidas: ["08:00", "12:00", "", ""],
      extra: "19:00-20:00",
      horasDiarias: "5h00",
    });
  });

  it("Totalização sem opcionais: Horas extras zeradas, sem banco de horas nem excesso do limite", () => {
    const { totalizacao } = documentoDoCartao(...folha({}, [dia("2026-11-02", 1)]));

    expect(totalizacao.map((i) => i.rotulo)).toEqual([
      "Horas trabalhadas",
      "Horas normais",
      "Horas extras",
      "Adicional noturno",
      "Atrasos",
      "Faltas",
      "Abonos",
      "Feriados trabalhados",
      "Sábados trabalhados",
      "Dias com lanche",
    ]);
  });

  it("Totalização com extras por faixa, banco de horas, excesso, falta e abono do mês", () => {
    const [f, c] = folha(
      {
        totalizacao: {
          ...ZERO,
          normaisMin: 525,
          extras: [
            { percentual: 50, minutos: 15 },
            { percentual: 100, minutos: 60 },
          ],
          bancoDeHorasMin: 30,
          acimaDoLimiteMin: 45,
          faltas: 1,
          abonoDias: 2,
          abonoMin: 1050,
        },
      },
      [dia("2026-11-02", 1, { trabalhadoMin: 540 })],
    );

    const { totalizacao } = documentoDoCartao(f, c);

    expect(totalizacao).toEqual([
      { rotulo: "Horas trabalhadas", valor: "9h00" },
      { rotulo: "Horas normais", valor: "8h45" },
      { rotulo: "Extras 50%", valor: "0h15" },
      { rotulo: "Extras 100%", valor: "1h00" },
      { rotulo: "Banco de horas", valor: "0h30" },
      { rotulo: "Extras acima do limite diário", valor: "0h45" },
      { rotulo: "Adicional noturno", valor: "0h00" },
      { rotulo: "Atrasos", valor: "0h00" },
      { rotulo: "Faltas", valor: "1 dia" },
      { rotulo: "Abonos", valor: "2 dias · 17h30" },
      { rotulo: "Feriados trabalhados", valor: "0" },
      { rotulo: "Sábados trabalhados", valor: "0" },
      { rotulo: "Dias com lanche", valor: "0" },
    ]);
  });

  it("sem convenção vigente em parte do mês: avisa que a Totalização seguiu a legislação", () => {
    const { avisoDaTotalizacao } = documentoDoCartao(...folha({ semConvencao: true }, []));

    expect(avisoDaTotalizacao).toContain("legislação");
  });
});
