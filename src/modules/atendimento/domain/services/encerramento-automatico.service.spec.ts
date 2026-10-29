import { corteDoEncerramento } from "./encerramento-automatico.service";

describe("corteDoEncerramento", () => {
  it("é 23h50 antes de agora: o cliente calado desde então já venceu", () => {
    const agora = new Date("2026-10-08T12:00:00.000Z");

    expect(corteDoEncerramento(agora)).toEqual(new Date("2026-10-07T12:10:00.000Z"));
  });
});
