import {
  hm,
  totalizar,
  totalizarDia,
  type DiaDoCartao,
  type Jornada,
} from "@/modules/rh/domain/services/totalizacao.service";

// Domingo a sábado: 8h45 de segunda a sexta, 4h no sábado (meio expediente), domingo sem carga.
const J: Jornada = [0, 525, 525, 525, 525, 525, 240];

function dia(data: string, p: Partial<DiaDoCartao> = {}): DiaDoCartao {
  return { data, batidas: [], extra: null, abono: false, feriado: false, ...p };
}
const par = (e: string, s: string) => ({ entrada: hm(e), saida: hm(s) });
const completo = [par("08:00", "12:00"), par("13:00", "17:45")]; // 8h45

describe("totalizarDia: dia útil", () => {
  it("jornada cumprida só soma horas normais", () => {
    const t = totalizarDia(dia("2026-11-02", { batidas: completo }), J);
    expect(t).toMatchObject({ normaisMin: 525, extras50Min: 0, atrasoMin: 0, faltas: 0 });
  });

  it("passou da jornada além da tolerância: o excesso é hora extra de 50%", () => {
    const t = totalizarDia(
      dia("2026-11-02", { batidas: [par("08:00", "12:00"), par("13:00", "18:45")] }),
      J,
    );
    expect(t).toMatchObject({ normaisMin: 525, extras50Min: 60, extras100Min: 0 });
  });

  it("variação de até 5 min por marcação (10 por dia) não conta", () => {
    const mais = totalizarDia(
      dia("2026-11-02", { batidas: [par("08:00", "12:00"), par("13:00", "17:55")] }),
      J,
    );
    expect(mais).toMatchObject({ normaisMin: 525, extras50Min: 0, atrasoMin: 0 });
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
    expect(t.extras50Min).toBe(11);
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
    expect(t).toMatchObject({ normaisMin: 240, extras50Min: 0, faltas: 0 });
  });

  it("sábado passando da carga: extra de 50%", () => {
    const t = totalizarDia(dia("2026-11-07", { batidas: [par("08:00", "13:00")] }), J);
    expect(t).toMatchObject({ normaisMin: 240, extras50Min: 60 });
  });

  it("domingo sem carga e sem batida é ignorado (nem falta)", () => {
    expect(totalizarDia(dia("2026-11-08"), J)).toMatchObject({ faltas: 0, normaisMin: 0 });
  });

  it("domingo: batida nas colunas normais é ignorada; na coluna Extra vira hora extra de 100%", () => {
    const ignorado = totalizarDia(dia("2026-11-08", { batidas: [par("08:00", "12:00")] }), J);
    expect(ignorado).toMatchObject({ normaisMin: 0, extras100Min: 0 });
    const extra = totalizarDia(dia("2026-11-08", { extra: par("08:00", "12:00") }), J);
    expect(extra).toMatchObject({ extras100Min: 240, extras50Min: 0, faltas: 0 });
  });

  it("feriado sem batida não é falta", () => {
    expect(totalizarDia(dia("2026-11-02", { feriado: true }), J)).toMatchObject({ faltas: 0 });
  });

  it("feriado trabalhado: tudo é hora extra de 100% e conta um feriado trabalhado", () => {
    const t = totalizarDia(dia("2026-11-02", { feriado: true, batidas: completo }), J);
    expect(t).toMatchObject({ normaisMin: 0, extras100Min: 525, feriadosTrabalhados: 1 });
  });

  it("coluna Extra em dia útil soma 50%", () => {
    const t = totalizarDia(
      dia("2026-11-02", { batidas: completo, extra: par("18:00", "19:00") }),
      J,
    );
    expect(t).toMatchObject({ normaisMin: 525, extras50Min: 60 });
  });
});

describe("totalizarDia: adicional noturno", () => {
  it("22h às 5h com hora reduzida (52min30s = 1h)", () => {
    // Jornada noturna 22:00 às 05:00 = 7h reais; 7h * 60/52,5 = 8h computadas.
    const jn: Jornada = [0, 420, 420, 420, 420, 420, 0];
    const t = totalizarDia(dia("2026-11-02", { batidas: [par("22:00", "05:00")] }), jn);
    expect(t).toMatchObject({ normaisMin: 420, noturnoMin: 480, extras50Min: 0, atrasoMin: 0 });
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
      extras50Min: 0,
      extras100Min: 120 + 525,
      noturnoMin: 0,
      atrasoMin: 0,
      faltas: 1,
      abonoDias: 1,
      abonoMin: 525,
      feriadosTrabalhados: 1,
    });
  });
});

describe("hm", () => {
  it("converte HH:MM em minutos", () => {
    expect(hm("08:30")).toBe(510);
  });
});
