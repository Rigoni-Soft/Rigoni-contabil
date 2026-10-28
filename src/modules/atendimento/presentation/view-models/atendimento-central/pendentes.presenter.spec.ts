import { totalDePendentes } from "./pendentes.presenter";

describe("totalDePendentes", () => {
  it("soma a espera e só as conversas em que o cliente escreveu por último", () => {
    const conversas = [{ aguardando: true }, { aguardando: false }, { aguardando: true }];

    expect(totalDePendentes(3, conversas)).toBe(5);
  });

  it("é zero sem espera e sem cliente aguardando", () => {
    expect(totalDePendentes(0, [{ aguardando: false }])).toBe(0);
  });
});
