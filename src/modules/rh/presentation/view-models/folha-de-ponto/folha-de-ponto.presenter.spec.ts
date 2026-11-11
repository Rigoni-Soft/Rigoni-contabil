import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import {
  cartaoSemDados,
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
  padraoComissionados: false,
  empregados: [ANA, { ...ANA, id: "e2", nome: "Bia", ativo: false, comissionado: false }],
  podeEditar: true,
  selecionado: {
    empregado: ANA,
    dias: [],
    totalizacao: {} as never,
    iniciado: false,
    semConvencao: false,
  },
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
    const [seg, dom, fer] = linhasDoCartao(
      [
        { ...base, data: "2026-11-16", diaDaSemana: 1, batidas: [{ entrada: 480, saida: 720 }] },
        {
          ...base,
          data: "2026-11-22",
          diaDaSemana: 0,
          cargaMin: 0,
          extra: { entrada: 480, saida: 600 },
        },
        { ...base, data: "2026-11-20", diaDaSemana: 5, feriado: true },
      ],
      false,
    );
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
    const [dia, falta] = linhasDoCartao(
      [
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
      ],
      false,
    );
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
    expect(falta).toMatchObject({ situacao: "falta", tom: "alerta" });
    expect(dia).toMatchObject({ situacao: "normal", tom: "info", nota: "Hora extra" });
  });

  it("o tom e a nota do dia: falta, hora extra, folga e feriado; dia normal sem tom", () => {
    const base = {
      batidas: [],
      extra: null,
      abono: false,
      cargaMin: 525,
      feriado: false,
      trabalhadoMin: 0,
      apuracao: ZERO,
    };
    const [normal, folga, feriado, feriadoTrabalhado] = linhasDoCartao(
      [
        { ...base, data: "2026-11-17", diaDaSemana: 2, apuracao: { ...ZERO, normaisMin: 525 } },
        { ...base, data: "2026-11-22", diaDaSemana: 0, cargaMin: 0 },
        { ...base, data: "2026-11-20", diaDaSemana: 5, feriado: true },
        {
          ...base,
          data: "2026-11-20",
          diaDaSemana: 5,
          feriado: true,
          apuracao: { ...ZERO, extras: [{ percentual: 100, minutos: 240 }] },
        },
      ],
      false,
    );
    expect(normal).toMatchObject({ tom: undefined, nota: undefined });
    expect(folga).toMatchObject({ tom: "atencao", nota: "Folga" });
    expect(feriado).toMatchObject({ tom: "atencao", nota: "Feriado" });
    expect(feriadoTrabalhado).toMatchObject({ tom: "info", nota: "Feriado · hora extra" });
  });

  it("cartão sem dados não conta faltas na Totalização (os dias úteis vazios ainda não são falta)", () => {
    const t = { ...ZERO, faltas: 20 };
    const faltas = (semDados: boolean) =>
      itensDaTotalizacao(t, 0, semDados).find((i) => i.rotulo === "Faltas")?.valor;

    expect(faltas(true)).toBe("0 dias");
    expect(faltas(false)).toBe("20 dias");
  });

  it("situação do dia: abonado, folga, falta e em branco (cartão sem dados)", () => {
    const base = {
      batidas: [],
      extra: null,
      abono: false,
      cargaMin: 525,
      feriado: false,
      trabalhadoMin: 0,
      apuracao: { ...ZERO, faltas: 1 },
    };
    const trabalhado = { ...base, batidas: [{ entrada: 480, saida: 1005 }], apuracao: ZERO };
    const [comecado, falta, abonado, folga] = linhasDoCartao(
      [
        { ...trabalhado, data: "2026-11-16", diaDaSemana: 1 },
        { ...base, data: "2026-11-17", diaDaSemana: 2 },
        {
          ...base,
          data: "2026-11-18",
          diaDaSemana: 3,
          abono: true,
          apuracao: { ...ZERO, abonoDias: 1 },
        },
        { ...base, data: "2026-11-22", diaDaSemana: 0, cargaMin: 0, apuracao: ZERO },
      ],
      false,
    );
    expect(comecado.situacao).toBe("normal");
    expect(falta).toMatchObject({ situacao: "falta", nota: "Falta", tom: "alerta" });
    expect(abonado).toMatchObject({ situacao: "abonado", nota: "Abonado", tom: undefined });
    expect(folga.situacao).toBe("folga");

    // Mês novo: nenhum dado salvo, o dia útil vazio não é falta, é "em branco" e neutro.
    const [branco] = linhasDoCartao([{ ...base, data: "2026-11-17", diaDaSemana: 2 }], false);
    expect(branco).toMatchObject({ situacao: "branco", nota: undefined, tom: undefined });
    expect(cartaoSemDados([{ ...base, data: "2026-11-17" }], false)).toBe(true);
    // Cartão salvo uma vez, mesmo sem nenhum horário: deixou de ser novo e o dia útil vazio é falta.
    expect(cartaoSemDados([{ ...base, data: "2026-11-17" }], true)).toBe(false);
    const [salvoVazio] = linhasDoCartao([{ ...base, data: "2026-11-17", diaDaSemana: 2 }], true);
    expect(salvoVazio).toMatchObject({ situacao: "falta", nota: "Falta", tom: "alerta" });
    expect(cartaoSemDados([{ ...base, data: "2026-11-17", abono: true }], false)).toBe(false);
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
    expect(ana.href).toBe("/rh/folha-de-ponto/c1?mes=2020-11&empregado=e1");
    expect(ana.cartaoHref).toBe("/rh/folha-de-ponto/c1/cartao/e1?mes=2020-11");
    expect(bia).toMatchObject({ selecionado: false, selos: ["desligado"] });
  });

  it("navega entre meses (sem próximo no mês corrente)", () => {
    const nav = navegacaoDoCartao(FOLHA);
    expect(nav.mesAnteriorHref).toContain("mes=2020-10");
    expect(nav.proximoMesHref).toContain("mes=2020-12");
    expect(navegacaoDoCartao({ ...FOLHA, competencia: "2099-01" }).proximoMesHref).toBeUndefined();
  });

  it("hrefDoCartao leva ao cartão do empregado com o mês", () => {
    expect(hrefDoCartao("c 1", "e1", { mes: "2026-11" })).toBe(
      "/rh/folha-de-ponto/c%201/cartao/e1?mes=2026-11",
    );
    expect(hrefDoCartao("c1", "e1", {})).toBe("/rh/folha-de-ponto/c1/cartao/e1");
  });

  it("hrefDaFolha omite o que não foi pedido", () => {
    expect(hrefDaFolha("c 1", {})).toBe("/rh/folha-de-ponto/c%201");
  });
});
