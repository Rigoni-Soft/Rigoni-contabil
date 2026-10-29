import { corteDoEncerramento } from "./encerramento-automatico.service";

describe("corteDoEncerramento", () => {
  it("é 23h50 antes de agora: o cliente calado desde então já venceu", () => {
    const agora = new Date("2026-10-08T12:00:00.000Z");

    expect(corteDoEncerramento(agora)).toEqual(new Date("2026-10-07T12:10:00.000Z"));
  });

  it("não depende do expediente: atravessa a noite, o fim de semana e o feriado sem pausa", () => {
    const sabado = new Date("2026-10-10T03:00:00.000Z");

    expect(corteDoEncerramento(sabado)).toEqual(new Date("2026-10-09T03:10:00.000Z"));
  });
});
