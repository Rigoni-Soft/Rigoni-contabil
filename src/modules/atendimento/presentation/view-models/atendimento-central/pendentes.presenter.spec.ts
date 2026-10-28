import { contarAguardando } from "./pendentes.presenter";

describe("contarAguardando", () => {
  it("conta só as conversas em que o cliente escreveu por último", () => {
    expect(
      contarAguardando([{ aguardando: true }, { aguardando: false }, { aguardando: true }]),
    ).toBe(2);
  });

  it("é zero sem cliente aguardando", () => {
    expect(contarAguardando([{ aguardando: false }])).toBe(0);
  });
});
