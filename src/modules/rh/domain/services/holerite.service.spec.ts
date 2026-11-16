import { situacaoDoHolerite } from "./holerite.service";

describe("situacaoDoHolerite", () => {
  it.each([
    [{ cadastrados: 0, semMovimento: 0, cartoes: 0 }, "nao_aplica"],
    [{ cadastrados: 2, semMovimento: 2, cartoes: 0 }, "nao_aplica"],
    [{ cadastrados: 3, semMovimento: 0, cartoes: 2 }, "pendente"],
    [{ cadastrados: 3, semMovimento: 0, cartoes: 3 }, "concluido"],
    [{ cadastrados: 3, semMovimento: 1, cartoes: 2 }, "concluido"],
  ] as const)("%j → %s", (contagem, esperado) => {
    expect(situacaoDoHolerite(contagem)).toBe(esperado);
  });
});
