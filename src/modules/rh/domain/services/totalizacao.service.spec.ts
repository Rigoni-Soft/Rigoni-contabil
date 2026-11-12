import {
  LEGISLACAO,
  regrasDeCalculo,
  type RegrasDeCalculo,
} from "@/modules/rh/domain/services/regras-de-calculo.service";
import {
  horaParaMinutos,
  totalizar,
  totalizarDia,
  type DiaDoCartao,
  type Jornada,
} from "@/modules/rh/domain/services/totalizacao.service";
import type { RegrasDaConvencao } from "@/shared/kernel/regras-da-convencao";

// Domingo a sábado: 8h45 de segunda a sexta, 4h no sábado (meio expediente), domingo sem carga.
const J: Jornada = [0, 525, 525, 525, 525, 525, 240];

// Minutos de hora extra paga no percentual.
const faixa = (t: { extras: { percentual: number; minutos: number }[] }, pct: number) =>
  t.extras.find((e) => e.percentual === pct)?.minutos ?? 0;

function dia(data: string, p: Partial<DiaDoCartao> = {}): DiaDoCartao {
  return { data, batidas: [], extra: null, abono: false, feriado: false, ...p };
}
const par = (e: string, s: string) => ({ entrada: horaParaMinutos(e), saida: horaParaMinutos(s) });
const completo = [par("08:00", "12:00"), par("13:00", "17:45")]; // 8h45

describe("totalizarDia: dia útil", () => {
  it("jornada cumprida só soma horas normais", () => {
    const t = totalizarDia(dia("2026-11-02", { batidas: completo }), J);
    expect(t).toMatchObject({ normaisMin: 525, extras: [], atrasoMin: 0, faltas: 0 });
  });

  it("passou da jornada além da tolerância: o excesso é hora extra de 50%", () => {
    const t = totalizarDia(
      dia("2026-11-02", { batidas: [par("08:00", "12:00"), par("13:00", "18:45")] }),
      J,
    );
    expect(t).toMatchObject({ normaisMin: 525, extras: [{ percentual: 50, minutos: 60 }] });
  });

  it("variação de até 5 min por marcação (10 por dia) não conta", () => {
    const mais = totalizarDia(
      dia("2026-11-02", { batidas: [par("08:00", "12:00"), par("13:00", "17:55")] }),
      J,
    );
    expect(mais).toMatchObject({ normaisMin: 525, extras: [], atrasoMin: 0 });
    const menos = totalizarDia(
      dia("2026-11-02", { batidas: [par("08:00", "12:00"), par("13:00", "17:35")] }),
      J,
    );
    expect(menos).toMatchObject({ normaisMin: 525, atrasoMin: 0 });
  });

  it("acima de 10 min no dia, tudo conta (não só o que passa da tolerância)", () => {
    const t = totalizarDia(
      dia("2026-11-02", { batidas: [par("08:00", "12:00"), par("13:00", "17:56")] }),
      J,
    );
    expect(faixa(t, 50)).toBe(11);
  });

  it("chegou atrasado além da tolerância: atraso, e as horas normais são as trabalhadas", () => {
    const t = totalizarDia(
      dia("2026-11-02", { batidas: [par("08:30", "12:00"), par("13:00", "17:45")] }),
      J,
    );
    expect(t).toMatchObject({ normaisMin: 495, atrasoMin: 30, faltas: 0 });
  });

  it("dia com carga e sem batida é falta", () => {
    expect(totalizarDia(dia("2026-11-03"), J)).toMatchObject({ faltas: 1, normaisMin: 0 });
  });

  it("abono no dia sem batida não é falta e soma a carga como abonada", () => {
    const t = totalizarDia(dia("2026-11-03", { abono: true }), J);
    expect(t).toMatchObject({ faltas: 0, abonoDias: 1, abonoMin: 525 });
  });

  it("abono com batida parcial abona só o que faltou, sem atraso", () => {
    const t = totalizarDia(dia("2026-11-03", { abono: true, batidas: [par("08:00", "12:00")] }), J);
    expect(t).toMatchObject({
      normaisMin: 240,
      atrasoMin: 0,
      abonoMin: 285,
      abonoDias: 0,
      faltas: 0,
    });
  });
});

describe("totalizarDia: sábado, domingo e feriado", () => {
  it("sábado de meio expediente cumprido fecha normal", () => {
    const t = totalizarDia(dia("2026-11-07", { batidas: [par("08:00", "12:00")] }), J);
    expect(t).toMatchObject({ normaisMin: 240, extras: [], faltas: 0 });
  });

  it("sábado passando da carga: extra de 50%", () => {
    const t = totalizarDia(dia("2026-11-07", { batidas: [par("08:00", "13:00")] }), J);
    expect(t).toMatchObject({ normaisMin: 240, extras: [{ percentual: 50, minutos: 60 }] });
  });

  it("domingo sem carga e sem batida é ignorado (nem falta)", () => {
    expect(totalizarDia(dia("2026-11-08"), J)).toMatchObject({ faltas: 0, normaisMin: 0 });
  });

  it("domingo: batida nas colunas normais é ignorada; na coluna Extra vira hora extra de 100%", () => {
    const ignorado = totalizarDia(dia("2026-11-08", { batidas: [par("08:00", "12:00")] }), J);
    expect(ignorado).toMatchObject({ normaisMin: 0, extras: [] });
    const extra = totalizarDia(dia("2026-11-08", { extra: par("08:00", "12:00") }), J);
    expect(extra).toMatchObject({ extras: [{ percentual: 100, minutos: 240 }], faltas: 0 });
  });

  it("feriado sem batida não é falta", () => {
    expect(totalizarDia(dia("2026-11-02", { feriado: true }), J)).toMatchObject({ faltas: 0 });
  });

  it("feriado trabalhado só na coluna Extra também conta um feriado trabalhado", () => {
    const t = totalizarDia(
      dia("2026-11-02", {
        feriado: true,
        extra: { entrada: horaParaMinutos("08:00"), saida: horaParaMinutos("12:00") },
      }),
      J,
    );
    expect(t).toMatchObject({ feriadosTrabalhados: 1, faltas: 0 });
    expect(t.extras).toEqual([{ percentual: 100, minutos: 240 }]);
  });

  it("feriado trabalhado: tudo é hora extra de 100% e conta um feriado trabalhado", () => {
    const t = totalizarDia(dia("2026-11-02", { feriado: true, batidas: completo }), J);
    expect(t).toMatchObject({
      normaisMin: 0,
      extras: [{ percentual: 100, minutos: 525 }],
      feriadosTrabalhados: 1,
    });
  });

  it("coluna Extra em dia útil soma 50%", () => {
    const t = totalizarDia(
      dia("2026-11-02", { batidas: completo, extra: par("18:00", "19:00") }),
      J,
    );
    expect(t).toMatchObject({ normaisMin: 525, extras: [{ percentual: 50, minutos: 60 }] });
  });
});

describe("totalizarDia: adicional noturno", () => {
  it("22h às 5h com hora reduzida (52min30s = 1h)", () => {
    // Jornada noturna 22:00 às 05:00 = 7h reais; 7h * 60/52,5 = 8h computadas.
    const jn: Jornada = [0, 420, 420, 420, 420, 420, 0];
    const t = totalizarDia(dia("2026-11-02", { batidas: [par("22:00", "05:00")] }), jn);
    expect(t).toMatchObject({ normaisMin: 420, noturnoMin: 480, extras: [], atrasoMin: 0 });
  });

  it("só o trecho dentro da janela conta", () => {
    const t = totalizarDia(
      dia("2026-11-02", { batidas: [par("20:00", "23:00")] }),
      [0, 180, 180, 180, 180, 180, 0],
    );
    // 1h real dentro da janela (22h às 23h) -> 60 * 8/7 = 69 min computados.
    expect(t.noturnoMin).toBe(69);
  });
});

describe("totalizar: período", () => {
  it("soma os dias", () => {
    const t = totalizar(
      [
        dia("2026-11-02", { batidas: completo }),
        dia("2026-11-03"), // falta
        dia("2026-11-04", { abono: true }),
        dia("2026-11-08", { extra: par("08:00", "10:00") }),
        dia("2026-11-09", { feriado: true, batidas: completo }),
      ],
      J,
    );
    expect(t).toEqual({
      normaisMin: 525,
      extras: [{ percentual: 100, minutos: 120 + 525 }],
      bancoDeHorasMin: 0,
      acimaDoLimiteMin: 0,
      noturnoMin: 0,
      atrasoMin: 0,
      faltas: 1,
      abonoDias: 1,
      abonoMin: 525,
      feriadosTrabalhados: 1,
      sabadosTrabalhados: 0,
      diasComLanche: 2,
    });
  });
});

// Convenção de exemplo (comércio): sábado a 60%, 25/12 a 150% (comissionado 100%), demais feriados a 125%.
const CONVENCAO = {
  versao: 1,
  rejeitadas: [],
  aplicadas: [
    { chave: "extra_sabado", valor: 60, clausula: "12ª", trecho: "60%" },
    { chave: "limite_extras_dia", valor: 90, clausula: "11ª", trecho: "90 minutos" },
    {
      chave: "datas_especiais",
      valor: [
        { descricao: "Natal", data: "25/12", percentual: 150, percentualComissionado: 100 },
        { descricao: "Demais feriados", data: null, percentual: 125 },
      ],
      clausula: "14ª",
      trecho: "25/12 150% 100% 125%",
    },
  ],
} satisfies RegrasDaConvencao;
const SEM_INTERRUPTORES = { bancoDeHoras: false, trabalhoAosDomingos: false };
const comConvencao = (o: Partial<RegrasDeCalculo> = {}, comissionado = false): RegrasDeCalculo => ({
  ...regrasDeCalculo(CONVENCAO, SEM_INTERRUPTORES, comissionado),
  ...o,
});

describe("totalizarDia: parâmetros da convenção", () => {
  const sabado = dia("2026-11-07", { batidas: [par("08:00", "13:00")] }); // carga 4h, 1h extra

  it("mesmo cartão, convenções diferentes, totais diferentes", () => {
    const lei = totalizarDia(sabado, J, LEGISLACAO);
    const convencao = totalizarDia(sabado, J, comConvencao());
    expect(lei.extras).toEqual([{ percentual: 50, minutos: 60 }]);
    expect(convencao.extras).toEqual([{ percentual: 60, minutos: 60 }]);
  });

  it("toda hora extra de sábado paga o percentual do sábado, inclusive a coluna Extra", () => {
    const t = totalizarDia(dia("2026-11-14", { extra: par("14:00", "16:00") }), J, comConvencao());
    expect(t.extras).toEqual([{ percentual: 60, minutos: 120 }]);
  });

  it("data fixa da convenção usa o percentual dela, e o do comissionado quando há", () => {
    const natal = dia("2026-12-25", { feriado: true, batidas: [par("08:00", "12:00")] });
    expect(totalizarDia(natal, J, comConvencao()).extras).toEqual([
      { percentual: 150, minutos: 240 },
    ]);
    expect(totalizarDia(natal, J, comConvencao({}, true)).extras).toEqual([
      { percentual: 100, minutos: 240 },
    ]);
  });

  it("feriado sem data fixa usa o percentual de 'demais feriados'; sem convenção, 100%", () => {
    const feriado = dia("2026-11-02", { feriado: true, batidas: [par("08:00", "10:00")] });
    expect(totalizarDia(feriado, J, comConvencao()).extras).toEqual([
      { percentual: 125, minutos: 120 },
    ]);
    expect(totalizarDia(feriado, J, LEGISLACAO).extras).toEqual([
      { percentual: 100, minutos: 120 },
    ]);
  });

  it("passou do limite diário de extras: segue paga e o excesso vira alerta", () => {
    // 2h extras com limite de 90 min.
    const t = totalizarDia(
      dia("2026-11-02", { batidas: [par("08:00", "12:00"), par("13:00", "19:45")] }),
      J,
      comConvencao(),
    );
    expect(t).toMatchObject({ extras: [{ percentual: 50, minutos: 120 }], acimaDoLimiteMin: 30 });
  });

  it("limite não vale em feriado: tudo é extra", () => {
    const t = totalizarDia(
      dia("2026-11-02", { feriado: true, batidas: completo }),
      J,
      comConvencao(),
    );
    expect(t.acimaDoLimiteMin).toBe(0);
  });

  it("banco de horas ligado: extra de dia útil vai ao banco, a de feriado segue paga", () => {
    const regras = { ...comConvencao(), bancoDeHoras: true };
    const util = totalizarDia(
      dia("2026-11-02", { batidas: [par("08:00", "12:00"), par("13:00", "18:45")] }),
      J,
      regras,
    );
    const feriado = totalizarDia(
      dia("2026-11-02", { feriado: true, batidas: completo }),
      J,
      regras,
    );
    expect(util).toMatchObject({ extras: [], bancoDeHorasMin: 60, diasComLanche: 1 });
    expect(feriado).toMatchObject({
      bancoDeHorasMin: 0,
      extras: [{ percentual: 125, minutos: 525 }],
    });
  });

  it("trabalho aos domingos ligado: a batida do domingo vira hora extra de 100%", () => {
    const regras = { ...LEGISLACAO, trabalhoAosDomingos: true };
    const t = totalizarDia(dia("2026-11-08", { batidas: [par("08:00", "12:00")] }), J, regras);
    expect(t).toMatchObject({ extras: [{ percentual: 100, minutos: 240 }], faltas: 0 });
  });

  it("conta sábados trabalhados e dias com direito a lanche", () => {
    const t = totalizar(
      [
        dia("2026-11-07", { batidas: [par("08:00", "12:00")] }),
        dia("2026-11-14", { batidas: [par("08:00", "13:00")] }),
        dia("2026-11-21"),
      ],
      J,
    );
    expect(t).toMatchObject({ sabadosTrabalhados: 2, diasComLanche: 1 });
  });
});

describe("totalizar: convenção da época", () => {
  it("cada dia usa as regras da sua data", () => {
    const dias = [
      dia("2026-11-07", { batidas: [par("08:00", "13:00")] }),
      dia("2026-11-14", { batidas: [par("08:00", "13:00")] }),
    ];
    const t = totalizar(dias, J, (data) => (data < "2026-11-10" ? LEGISLACAO : comConvencao()));
    expect(t.extras).toEqual([
      { percentual: 50, minutos: 60 },
      { percentual: 60, minutos: 60 },
    ]);
  });
});

describe("horaParaMinutos", () => {
  it("converte HH:MM em minutos", () => {
    expect(horaParaMinutos("08:30")).toBe(510);
  });
});
