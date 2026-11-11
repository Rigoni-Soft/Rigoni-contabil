import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import {
  cargaHorariaDoCartao,
  hmParaMinutos,
  hrefDaFolha,
  hrefDoCartao,
  itensDaTotalizacao,
  lerDiaDoFormulario,
  lerEmpregadoDoFormulario,
  linhasDoCartao,
  minutosParaHm,
  navegacaoDoCartao,
  quadroDoEmpregado,
  totaisDoCartao,
} from "@/modules/rh/presentation/view-models/folha-de-ponto/folha-de-ponto.presenter";

const campos = (valores: Record<string, string>) => ({
  get: (nome: string) => valores[nome] ?? null,
});
const ANA = {
  id: "e1",
  nome: "Ana",
  jornada: [0, 525, 525, 525, 525, 525, 240],
  comissionado: true,
  ativo: true,
  semMovimento: false,
};
const FOLHA: FolhaDePontoDto = {
  clienteId: "c1",
  empresa: "Teste Ltda",
  competencia: "2020-11",
  quinzena: 2,
  padraoComissionados: false,
  empregados: [ANA, { ...ANA, id: "e2", nome: "Bia", ativo: false, comissionado: false }],
  podeEditar: true,
  selecionado: { empregado: ANA, dias: [], totalizacao: {} as never, semConvencao: false },
};

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

describe("horários", () => {
  it("converte entre minutos e HH:MM", () => {
    expect(minutosParaHm(525)).toBe("08:45");
    expect(hmParaMinutos("08:45")).toBe(525);
    expect(hmParaMinutos("24:00")).toBeNull();
    expect(hmParaMinutos("")).toBeNull();
  });
});

describe("itensDaTotalizacao", () => {
  it("formata horas e dias", () => {
    const itens = itensDaTotalizacao(
      {
        normaisMin: 525,
        extras: [{ percentual: 60, minutos: 60 }],
        bancoDeHorasMin: 0,
        acimaDoLimiteMin: 0,
        noturnoMin: 69,
        atrasoMin: 5,
        faltas: 1,
        abonoDias: 2,
        abonoMin: 1050,
        feriadosTrabalhados: 1,
        sabadosTrabalhados: 2,
        diasComLanche: 3,
      },
      525,
    );
    expect(itens.map((i) => i.rotulo)).toContain("Extras 60%");
    expect(itens.map((i) => i.valor)).toEqual([
      "8h45",
      "8h45",
      "1h00",
      "1h09",
      "0h05",
      "1 dia",
      "2 dias · 17h30",
      "1",
      "2",
      "3",
    ]);
  });
});

describe("linhasDoCartao", () => {
  it("rotula o dia e marca feriado e dia sem jornada", () => {
    const base = {
      batidas: [],
      extra: null,
      abono: false,
      cargaMin: 525,
      feriado: false,
      trabalhadoMin: 0,
      apuracao: ZERO,
    };
    const [seg, dom, fer] = linhasDoCartao([
      { ...base, data: "2026-11-16", diaDaSemana: 1, batidas: [{ entrada: 480, saida: 720 }] },
      {
        ...base,
        data: "2026-11-22",
        diaDaSemana: 0,
        cargaMin: 0,
        extra: { entrada: 480, saida: 600 },
      },
      { ...base, data: "2026-11-20", diaDaSemana: 5, feriado: true },
    ]);
    expect(seg).toMatchObject({
      rotulo: "seg 16/11",
      entrada1: "08:00",
      saida1: "12:00",
      entrada2: "",
    });
    expect(seg.nota).toBeUndefined();
    expect(dom).toMatchObject({ nota: "Folga", extraEntrada: "08:00", extraSaida: "10:00" });
    expect(fer.nota).toBe("Feriado");
  });

  it("traz as colunas calculadas da planilha: H. diária, atrasos, extras por faixa, A.N. e a falta", () => {
    const [dia, falta] = linhasDoCartao([
      {
        data: "2026-11-16",
        diaDaSemana: 1,
        batidas: [{ entrada: 480, saida: 1080 }],
        extra: null,
        abono: false,
        cargaMin: 525,
        feriado: false,
        trabalhadoMin: 600,
        apuracao: {
          ...ZERO,
          normaisMin: 525,
          extras: [{ percentual: 50, minutos: 75 }],
          noturnoMin: 8,
        },
      },
      {
        data: "2026-11-17",
        diaDaSemana: 2,
        batidas: [],
        extra: null,
        abono: false,
        cargaMin: 525,
        feriado: false,
        trabalhadoMin: 0,
        apuracao: { ...ZERO, faltas: 1 },
      },
    ]);
    expect(dia).toMatchObject({
      diaSemana: "seg",
      diaMes: "16/11",
      trabalhado: "10h00",
      atraso: "0h00",
      extras: "1h15",
      faixa1: "1h15 (50%)",
      faixa2: "",
      noturno: "0h08",
    });
    expect(falta.nota).toBe("Falta");
  });

  it("totaisDoCartao é a linha TOTAIS da planilha", () => {
    const t = {
      ...ZERO,
      faltas: 2,
      atrasoMin: 10,
      noturnoMin: 8,
      extras: [
        { percentual: 50, minutos: 75 },
        { percentual: 100, minutos: 60 },
      ],
      bancoDeHorasMin: 15,
    };
    const dia = {
      data: "2026-11-16",
      diaDaSemana: 1,
      batidas: [],
      extra: null,
      abono: false,
      cargaMin: 525,
      feriado: false,
      trabalhadoMin: 600,
      apuracao: ZERO,
    };
    expect(totaisDoCartao([dia, dia], t)).toEqual({
      faltas: "2",
      trabalhado: "20h00",
      atraso: "0h10",
      extras: "2h30",
      noturno: "0h08",
      faixas: "1h15 (50%) · 1h00 (100%)",
    });
  });

  it("cargaHorariaDoCartao lista a Jornada de domingo a sábado", () => {
    expect(cargaHorariaDoCartao([0, 525, 525, 525, 525, 525, 240])[6]).toEqual({
      rotulo: "sáb",
      valor: "4h00",
    });
    expect(cargaHorariaDoCartao([0, 525, 525, 525, 525, 525, 240])[0].valor).toBe("0h00");
  });
});

describe("lerDiaDoFormulario", () => {
  it("lê pares, extra e abono", () => {
    expect(
      lerDiaDoFormulario(
        campos({
          entrada1: "08:00",
          saida1: "12:00",
          extraEntrada: "18:00",
          extraSaida: "19:00",
          abono: "on",
        }),
      ),
    ).toEqual({
      ok: true,
      batidas: [{ entrada: 480, saida: 720 }],
      extra: { entrada: 1080, saida: 1140 },
      abono: true,
    });
  });

  it("dia em branco é válido (apaga o dia)", () => {
    expect(lerDiaDoFormulario(campos({}))).toEqual({
      ok: true,
      batidas: [],
      extra: null,
      abono: false,
    });
  });

  it("par pela metade ou com entrada igual à saída é erro", () => {
    expect(lerDiaDoFormulario(campos({ entrada1: "08:00" })).ok).toBe(false);
    expect(lerDiaDoFormulario(campos({ entrada1: "08:00", saida1: "08:00" })).ok).toBe(false);
  });
});

describe("lerEmpregadoDoFormulario", () => {
  it("lê o nome e a marca", () => {
    expect(lerEmpregadoDoFormulario(campos({ nome: " Ana ", comissionado: "on" }))).toEqual({
      nome: "Ana",
      comissionado: true,
    });
    expect(lerEmpregadoDoFormulario(campos({ nome: "Bia" })).comissionado).toBe(false);
  });
});

describe("quadro e navegação", () => {
  it("lista o quadro com selos e destaca o escolhido", () => {
    const [ana, bia] = quadroDoEmpregado(FOLHA);
    expect(ana).toMatchObject({ selecionado: true, selos: ["comissionado"] });
    expect(ana.href).toBe("/rh/folha-de-ponto/c1?mes=2020-11&quinzena=2&empregado=e1");
    expect(ana.cartaoHref).toBe("/rh/folha-de-ponto/c1/cartao/e1?mes=2020-11&quinzena=2");
    expect(bia).toMatchObject({ selecionado: false, selos: ["desligado"] });
  });

  it("navega entre meses (sem próximo no mês corrente) e quinzenas", () => {
    const nav = navegacaoDoCartao(FOLHA);
    expect(nav.mesAnteriorHref).toContain("mes=2020-10&quinzena=1");
    expect(nav.proximoMesHref).toContain("mes=2020-12");
    expect(nav.quinzenas.map((q) => q.atual)).toEqual([false, true]);
    expect(navegacaoDoCartao({ ...FOLHA, competencia: "2099-01" }).proximoMesHref).toBeUndefined();
  });

  it("hrefDoCartao leva ao cartão do empregado com o mês e a quinzena", () => {
    expect(hrefDoCartao("c 1", "e1", { mes: "2026-11", quinzena: 2 })).toBe(
      "/rh/folha-de-ponto/c%201/cartao/e1?mes=2026-11&quinzena=2",
    );
    expect(hrefDoCartao("c1", "e1", {})).toBe("/rh/folha-de-ponto/c1/cartao/e1");
  });

  it("hrefDaFolha omite o que não foi pedido", () => {
    expect(hrefDaFolha("c 1", {})).toBe("/rh/folha-de-ponto/c%201");
  });
});
